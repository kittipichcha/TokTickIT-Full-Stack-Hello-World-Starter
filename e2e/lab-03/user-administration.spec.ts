import { mkdirSync } from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { CHANGED_PASSWORD, USERS, login, makeSoleActiveAdmin, navigate, resetAccount } from "./helpers";

test.describe("E2E-03: Administrator user management", () => {
  test.beforeEach(async () => {
    await resetAccount("admin");
    await resetAccount("adminPeer");
    await resetAccount("requester");
  });

  test("searches, creates, edits, resets, and completes an Administrator self-reset", async ({ page }) => {
    await login(page, USERS.admin.email);
    await navigate(page, "User Management");
    await expect(page.getByRole("heading", { name: "User Management" })).toBeVisible();
    await page.getByLabel("Search users").fill(USERS.requester.name);
    await expect(page.locator(".admin-users-desktop:visible, .admin-user-cards:visible").getByText(USERS.requester.email)).toBeVisible();
    await page.getByLabel("Search users").clear();

    const directory = path.resolve("artifacts/lab-03/screenshots/user-management");
    mkdirSync(directory, { recursive: true });
    await page.screenshot({ path: path.join(directory, `${test.info().project.name}-users-list.png`) });

    await page.getByRole("button", { name: "Create User" }).click();
    await page.locator("#create-name").fill("Issue 42 Created User");
    await page.locator("#create-email").fill(USERS.requester.email);
    await page.locator("#create-password").fill("InitialPass123!xyz");
    await page.getByRole("dialog").getByRole("button", { name: "Create User" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.locator("#create-name")).toHaveValue("Issue 42 Created User");
    await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();

    const createdEmail = `issue42-created-${Date.now()}@example.com`;
    await page.getByRole("button", { name: "Create User" }).click();
    await page.locator("#create-name").fill("Issue 42 Created User");
    await page.locator("#create-email").fill(createdEmail);
    await page.locator("#create-password").fill("InitialPass123!xyz");
    await page.getByRole("dialog").getByRole("button", { name: "Create User" }).click();
    await expect(page.locator(".admin-user-success")).toHaveText("User created successfully.");

    const row = page.locator("tr:visible, .admin-user-card:visible").filter({ hasText: createdEmail }).first();
    await row.getByRole("button", { name: "Edit" }).click();
    await page.locator("#edit-name").fill("Issue 42 Edited User");
    await page.getByRole("dialog").getByRole("button", { name: "Save Changes" }).click();
    await expect(page.locator(".admin-user-success")).toHaveText("User updated successfully.");

    const editedRow = page.locator("tr:visible, .admin-user-card:visible").filter({ hasText: createdEmail }).first();
    await editedRow.getByRole("button", { name: "Reset Password" }).click();
    await page.locator("#reset-password").fill("ResetPass123!xyz");
    await page.getByRole("dialog").getByRole("button", { name: "Set Password" }).click();
    await expect(page.getByRole("dialog").getByRole("status")).toContainText("The user must");
    await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();

    const selfRow = page.locator("tr:visible, .admin-user-card:visible").filter({ hasText: USERS.admin.email }).first();
    await selfRow.getByRole("button", { name: "Reset Password" }).click();
    await page.locator("#reset-password").fill("AdminReset123!xyz");
    await page.getByRole("dialog").getByRole("button", { name: "Set Password" }).click();
    await expect(page.getByRole("heading", { name: "Change your password" })).toBeVisible();
    await page.getByLabel("Current password").fill("AdminReset123!xyz");
    await page.getByLabel(/^new password/i).fill(CHANGED_PASSWORD);
    await page.getByLabel(/^confirm new password/i).fill(CHANGED_PASSWORD);
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.locator(".app-header").first()).toBeVisible();
    await expect(page.locator(".identity")).toContainText(USERS.admin.name);

    await navigate(page, "User Management");
    const selfRowAfterReset = page.locator("tr:visible, .admin-user-card:visible").filter({ hasText: USERS.admin.email }).first();
    await selfRowAfterReset.getByRole("button", { name: "Edit" }).click();
    await page.locator("#edit-name").fill("Issue 42 Admin Updated");
    await page.getByRole("dialog").getByRole("button", { name: "Save Changes" }).click();
    await expect(page.locator(".app-header").first()).toBeVisible();
    await expect(page.locator(".identity")).toContainText("Issue 42 Admin Updated");
  });

  test("rejects invalid email input through the real user-management API", async ({ page }) => {
    await login(page, USERS.admin.email);
    await navigate(page, "User Management");
    await page.getByRole("button", { name: "Create User" }).click();
    await page.locator("#create-name").fill("Invalid Issue 42 User");
    await page.locator("#create-email").fill("not-an-email");
    await page.locator("#create-password").fill("InitialPass123!xyz");
    await page.getByRole("dialog").getByRole("button", { name: "Create User" }).click();
    await expect(page.getByText("A valid email is required.", { exact: true })).toBeVisible();
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("rejects Administrator self-deactivation while the peer Administrator remains active", async ({ page }) => {
    await login(page, USERS.admin.email);
    await navigate(page, "User Management");
    const selfRow = page.locator("tr:visible, .admin-user-card:visible").filter({ hasText: USERS.admin.email }).first();
    await selfRow.getByRole("button", { name: "Edit" }).click();
    await page.locator("#edit-active").uncheck();
    await page.getByRole("dialog").getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByRole("alert")).toHaveText("You cannot deactivate your own account.");
    await expect(page.locator("#edit-active")).not.toBeChecked();
    const editDialog = page.getByRole("dialog");
    await editDialog.getByRole("button", { name: "Cancel" }).click();
    await expect(editDialog).toBeHidden();
    const primaryNavigation = page.locator("#primary-navigation");
    if (!(await primaryNavigation.isVisible())) await page.locator(".hamburger").click();
    await expect(page.getByRole("link", { name: "User Management" })).toBeVisible();
  });

  test("rejects demoting the sole active Administrator and keeps the account authorized", async ({ page }) => {
    const restoreAdmins = await makeSoleActiveAdmin("admin");
    try {
      await login(page, USERS.admin.email);
      await navigate(page, "User Management");
      const selfRow = page.locator("tr:visible, .admin-user-card:visible").filter({ hasText: USERS.admin.email }).first();
      await selfRow.getByRole("button", { name: "Edit" }).click();
      await page.locator("#edit-role").selectOption("IT_STAFF");
      await page.getByRole("dialog").getByRole("button", { name: "Save Changes" }).click();
      await expect(page.getByRole("alert")).toHaveText("The last active Administrator's role cannot be changed to a non-Administrator role.");
      await expect(page.locator("#edit-role")).toHaveValue("IT_STAFF");
      const editDialog = page.getByRole("dialog");
      await editDialog.getByRole("button", { name: "Cancel" }).click();
      await expect(editDialog).toBeHidden();
      const primaryNavigation = page.locator("#primary-navigation");
      if (!(await primaryNavigation.isVisible())) await page.locator(".hamburger").click();
      await expect(page.getByRole("link", { name: "User Management" })).toBeVisible();
      const me = await page.request.get("http://localhost:3000/api/auth/me");
      expect(me.status()).toBe(200);
      expect((await me.json()).data.role).toBe("ADMINISTRATOR");
    } finally {
      await restoreAdmins();
    }
  });

  test("denies user-management access to a non-Administrator", async ({ page }) => {
    await login(page, USERS.requester.email);
    await expect(page.getByRole("link", { name: "User Management" })).toHaveCount(0);
    const response = await page.request.get("http://localhost:3000/api/admin/users");
    expect(response.status()).toBe(403);
  });
});
