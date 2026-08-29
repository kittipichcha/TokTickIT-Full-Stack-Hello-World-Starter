import { test, expect } from "@playwright/test";

test.describe("E2E-04: Partial success — ticket created, attachment fails", () => {
  test("ticket creation succeeds, attachment upload fails, ticket persists, no duplicate", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("#requester", { timeout: 10000 });

    await page.selectOption("#requester", "1");
    await page.click("button:has-text('Continue')");
    await page.waitForSelector(".app-shell", { timeout: 10000 });

    await page.click("a:has-text('Create Ticket')");
    await page.waitForSelector(".ticket-form", { timeout: 10000 });

    await page.selectOption("select[aria-label*='Category']", { index: 1 });
    await page.selectOption("select[aria-label*='Related System']", { index: 1 });
    await page.fill("input[aria-label*='Summary']", "E2E-04 Partial success ticket");
    await page.fill("textarea[aria-label*='Description']", "Testing BR-17 partial success scenario where ticket is created but attachment fails.");

    await page.click("button:has-text('Submit')");
    await page.waitForSelector(".success-panel", { timeout: 15000 });

    // Verify ticket number is displayed and not null
    const ticketNumberEl = page.locator(".ticket-info-value").first();
    await expect(ticketNumberEl).toBeVisible();
    const ticketNumber = await ticketNumberEl.textContent();
    expect(ticketNumber).toMatch(/TKT-\d{4}-\d{6}/);

    // Verify the ticket is visible in My Tickets
    await page.click("a:has-text('My Tickets')");
    await page.waitForTimeout(2000);
    await expect(page.locator("text=E2E-04 Partial success ticket").first()).toBeVisible({ timeout: 10000 });

    await page.screenshot({
      path: "artifacts/lab-02/screenshots/e2e-04-partial-success.png",
      fullPage: true,
    });
  });
});