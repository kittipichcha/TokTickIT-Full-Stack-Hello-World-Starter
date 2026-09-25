import { test, expect } from "@playwright/test";
import { USERS, createRequesterTicket, login, navigate, resetAccount } from "./helpers";

test.describe("VISUAL-01/02: integrated Lab 3 responsive layouts", () => {
  test.beforeEach(async () => {
    await resetAccount("requester");
    await resetAccount("staff");
    await resetAccount("admin");
  });

  test("Ticket Queue presents all ticket content without page-level horizontal overflow", async ({ page }) => {
    const summary = `Issue 42 responsive ${Date.now()}`;
    await login(page, USERS.requester.email);
    await createRequesterTicket(page, summary);
    await page.getByRole("button", { name: "Logout" }).click();
    await login(page, USERS.staff.email);
    await navigate(page, "Ticket Queue");
    await page.getByLabel("Search tickets").fill(summary);
    await expect(page.locator(".tickets-table-wrapper:visible, .tickets-cards:visible").getByText(summary, { exact: true })).toBeVisible();

    const width = page.viewportSize()!.width;
    if (width < 768) {
      await expect(page.locator(".staff-queue .tickets-cards")).toBeVisible();
      await expect(page.locator(".staff-queue .tickets-table-wrapper")).toBeHidden();
    } else {
      await expect(page.locator(".staff-queue .tickets-table-wrapper")).toBeVisible();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test("User Management switches between desktop table and labeled mobile cards", async ({ page }) => {
    await login(page, USERS.admin.email);
    await navigate(page, "User Management");
    await expect(page.getByRole("heading", { name: "User Management" })).toBeVisible();
    await expect(page.locator(".admin-users-desktop:visible, .admin-user-cards:visible").getByText(USERS.admin.email)).toBeVisible();

    const width = page.viewportSize()!.width;
    if (width < 768) {
      await expect(page.locator(".admin-user-cards")).toBeVisible();
      await expect(page.locator(".admin-users-desktop")).toBeHidden();
      await expect(page.locator(".admin-user-card-fields dt").first()).toHaveText("Email");
    } else {
      await expect(page.locator(".admin-users-desktop")).toBeVisible();
      await expect(page.locator(".admin-user-cards")).toBeHidden();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
