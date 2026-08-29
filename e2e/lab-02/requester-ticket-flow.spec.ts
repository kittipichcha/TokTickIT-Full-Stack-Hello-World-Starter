import { test, expect } from "@playwright/test";

test.describe("E2E-01: Requester creates ticket and finds it in My Tickets", () => {
  test("full requester flow: select requester → create ticket → find in My Tickets", async ({ page }) => {
    await page.goto("/");

    await page.waitForSelector("#requester", { timeout: 10000 });
    await page.selectOption("#requester", "1");
    await page.click("button:has-text('Continue')");
    await page.waitForSelector(".app-shell", { timeout: 10000 });
    await expect(page.locator("header.app-header")).toBeVisible();

    await page.click("a:has-text('Create Ticket')");
    await page.waitForSelector(".ticket-form", { timeout: 10000 });

    await page.selectOption("select[aria-label*='Category']", { index: 1 });
    await page.selectOption("select[aria-label*='Related System']", { index: 1 });
    await page.fill("input[aria-label*='Summary']", "E2E-01 Playwright test ticket");
    await page.fill("textarea[aria-label*='Description']", "This ticket was created by an automated Playwright E2E test.");

    await page.click("button:has-text('Submit')");
    await page.waitForSelector(".success-panel", { timeout: 15000 });

    const ticketNumberElement = page.locator(".ticket-info-value").first();
    await expect(ticketNumberElement).toBeVisible();
    const ticketNumber = await ticketNumberElement.textContent();
    expect(ticketNumber).toMatch(/TKT-\d{4}-\d{6}/);

    await page.click("a:has-text('My Tickets')");
    await page.waitForTimeout(2000);

    const ticketRow = page.locator("text=E2E-01 Playwright test ticket").first();
    await expect(ticketRow).toBeVisible({ timeout: 10000 });
    await expect(page.locator(`text=${ticketNumber}`).first()).toBeVisible({ timeout: 5000 });

    await page.screenshot({
      path: "artifacts/lab-02/screenshots/e2e-01-ticket-created.png",
      fullPage: true,
    });
  });
});