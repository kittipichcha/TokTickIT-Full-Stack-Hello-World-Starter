import { test, expect, type Locator, type Page } from "@playwright/test";
import { CHANGED_PASSWORD, E2E_ATTACHMENT, FORCED_PASSWORD, USERS, createRequesterTicket, login, navigate, resetAccount } from "./helpers";

async function expectControlInViewport(page: Page, control: Locator): Promise<void> {
  control = control.first();
  await control.scrollIntoViewIfNeeded();
  await expect(control).toBeVisible();
  const bounds = await control.boundingBox();
  const viewport = page.viewportSize()!;
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

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
    await expectControlInViewport(page, page.locator(".staff-queue h1"));
    await expectControlInViewport(page, page.locator("#queue-search"));

    const width = page.viewportSize()!.width;
    if (width < 768) {
      await expect(page.locator(".staff-queue .tickets-cards")).toBeVisible();
      await expect(page.locator(".staff-queue .tickets-table-wrapper")).toBeHidden();
    } else {
      await expect(page.locator(".staff-queue .tickets-table-wrapper")).toBeVisible();
    }
  });

  test("User Management switches between desktop table and labeled mobile cards", async ({ page }) => {
    await login(page, USERS.admin.email);
    await navigate(page, "User Management");
    await expect(page.getByRole("heading", { name: "User Management" })).toBeVisible();
    await expect(page.locator(".admin-users-desktop:visible, .admin-user-cards:visible").getByText(USERS.admin.email)).toBeVisible();
    await expectControlInViewport(page, page.locator("#admin-user-search"));
    await expectControlInViewport(page, page.locator(".my-tickets-toolbar > button"));

    const width = page.viewportSize()!.width;
    if (width < 768) {
      await expect(page.locator(".admin-user-cards")).toBeVisible();
      await expect(page.locator(".admin-users-desktop")).toBeHidden();
      await expect(page.locator(".admin-user-card-fields dt").first()).toHaveText("Email");
    } else {
      await expect(page.locator(".admin-users-desktop")).toBeVisible();
      await expect(page.locator(".admin-user-cards")).toBeHidden();
    }
  });

  test("authentication and Requester screens keep primary controls in the viewport", async ({ page }) => {
    await resetAccount("forced", true, FORCED_PASSWORD);
    await page.goto("/");
    await expectControlInViewport(page, page.locator("#login-email"));
    await login(page, USERS.forced.email, FORCED_PASSWORD, "change-password");
    await expectControlInViewport(page, page.locator("#chpwd-current"));
    await expectControlInViewport(page, page.locator(".auth-form button[type=submit]"));
    await page.getByLabel("Current password").fill(FORCED_PASSWORD);
    await page.getByLabel(/^new password/i).fill(CHANGED_PASSWORD);
    await page.getByLabel(/^confirm new password/i).fill(CHANGED_PASSWORD);
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.locator(".app-header").first()).toBeVisible();

    await page.getByRole("button", { name: "Logout" }).click();
    await login(page, USERS.requester.email);
    await navigate(page, "Create Ticket");
    await expectControlInViewport(page, page.locator("#summary"));
    const summary = `Issue 42 responsive requester ${Date.now()}`;
    const ticketNumber = await createRequesterTicket(page, summary, E2E_ATTACHMENT);
    await expect(page.getByText("Your ticket has been created successfully.", { exact: true })).toBeVisible();
    await expectControlInViewport(page, page.getByRole("heading", { name: "Ticket Created", exact: true }));
    await expect(page.locator(".success-panel .ticket-info-value").first()).toHaveText(ticketNumber);

    await navigate(page, "My Tickets");
    await expectControlInViewport(page, page.getByRole("link", { name: ticketNumber }));
    await page.getByRole("link", { name: ticketNumber }).click();
    await expectControlInViewport(page, page.locator("#comment-input"));
  });

  test("Staff Ticket Detail keeps ownership and comment controls in the viewport", async ({ page }) => {
    const summary = `Issue 42 responsive staff detail ${Date.now()}`;
    await login(page, USERS.requester.email);
    await createRequesterTicket(page, summary);
    await page.getByRole("button", { name: "Logout" }).click();
    await login(page, USERS.staff.email);
    await navigate(page, "Ticket Queue");
    await page.getByLabel("Search tickets").fill(summary);
    await page.getByRole("button", { name: "Open Detail" }).click();
    await expectControlInViewport(page, page.locator("#owner-select"));
    await expectControlInViewport(page, page.locator("#comment-input"));
    await expectControlInViewport(page, page.locator("#note-input"));
  });
});
