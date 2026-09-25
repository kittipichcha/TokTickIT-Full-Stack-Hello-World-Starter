import { mkdirSync } from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { CHANGED_PASSWORD, USERS, login, navigate, resetAccount } from "./helpers";

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
});
