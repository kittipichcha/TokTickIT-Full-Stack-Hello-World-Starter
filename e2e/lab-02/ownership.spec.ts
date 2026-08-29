import { test, expect } from "@playwright/test";

test.describe("E2E-02: Ownership isolation across two requester contexts", () => {
  test("Requester A creates a ticket, Requester B cannot see it", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("#requester", { timeout: 10000 });

    // === Requester A creates a ticket ===
    await page.selectOption("#requester", "1");
    await page.click("button:has-text('Continue')");
    await page.waitForSelector(".app-shell", { timeout: 10000 });

    await page.click("a:has-text('Create Ticket')");
    await page.waitForSelector(".ticket-form", { timeout: 10000 });

    await page.selectOption("select[aria-label*='Category']", { index: 1 });
    await page.selectOption("select[aria-label*='Related System']", { index: 1 });
    await page.fill("input[aria-label*='Summary']", "Requester A's private ticket");
    await page.fill("textarea[aria-label*='Description']", "This ticket belongs to Requester A and must not be visible to Requester B.");

    await page.click("button:has-text('Submit')");
    await page.waitForSelector(".success-panel", { timeout: 15000 });
    const ticketNumberEl = page.locator(".ticket-info-value").first();
    const ticketNumber = await ticketNumberEl.textContent();

    // === Switch to Requester B ===
    await page.click("button:has-text('Change Requester')");
    await page.waitForSelector("#requester", { timeout: 10000 });

    await page.selectOption("#requester", "2");
    await page.click("button:has-text('Continue')");
    await page.waitForSelector(".app-shell", { timeout: 10000 });

    // === Verify Requester B cannot see Requester A's ticket ===
    await page.waitForTimeout(2000);

    // Requester B should NOT see A's ticket
    await expect(page.locator("text=Requester A's private ticket").first()).not.toBeVisible({ timeout: 5000 });

    await page.screenshot({
      path: "artifacts/lab-02/screenshots/e2e-02-ownership-isolation.png",
      fullPage: true,
    });
  });
});