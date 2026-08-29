import { test, expect } from "@playwright/test";
import {
  selectRequester,
  openCreateTicket,
  openMyTickets,
  openTicketBySummary,
  VALID_PNG_BUFFER,
} from "./helpers";

/**
 * E2E-04: BR-17 partial success — ticket created, attachment upload fails.
 *
 * This is the highest-priority repair. The previous test created a ticket but
 * never actually caused the attachment upload to fail, so it did not test
 * Case B. This test FORCES the attachment upload to fail via Playwright route
 * interception (no production code change), then proves:
 *
 *   Create Ticket → ticket persisted → attachment FAILS → ticket remains
 *   → attachment failure displayed → open Ticket Detail → retry attachment
 *   → retry succeeds → SAME Ticket Number → exactly one ticket
 *
 * Critical assertion: original Ticket Number === final Ticket Number, and the
 * list/detail state contains exactly one ticket with that identifier.
 */
test.describe("E2E-04: Partial success — ticket created, attachment fails", () => {
  test("ticket creation succeeds, attachment upload fails, ticket persists, no duplicate, retry succeeds", async ({ page }) => {
    const summary = `E2E-04 Partial success ticket ${Date.now()}`;
    const description = "Testing BR-17 partial success where the ticket is created but the attachment upload fails.";
    const fileName = "partial-success.png";

    // Force the attachment upload to fail (Case B). The ticket creation POST
    // is NOT intercepted — it goes to the real API and persists.
    let uploadAttempts = 0;
    await page.route(/\/api\/tickets\/TKT-\d{4}-\d{6}\/attachments$/, async (route) => {
      if (route.request().method() === "POST") {
        uploadAttempts++;
        await route.fulfill({
          status: 415,
          contentType: "application/json",
          body: JSON.stringify({
            error: { code: "UNSUPPORTED_MEDIA_TYPE", message: "File type not supported." },
          }),
        });
        return;
      }
      await route.continue();
    });

    // 1. Create the ticket with a valid attachment selected.
    await selectRequester(page, "1");
    await openCreateTicket(page);

    await page.selectOption("#categoryId", { index: 1 });
    await page.selectOption("#relatedSystemId", { index: 1 });
    await page.fill("#summary", summary);
    await page.fill("#description", description);

    // Select a valid file BEFORE submitting so the create flow attempts the upload.
    const fcPromise = page.waitForEvent("filechooser");
    await page.click("text=Browse files");
    const fc = await fcPromise;
    await fc.setFiles({ name: fileName, mimeType: "image/png", buffer: VALID_PNG_BUFFER });
    await page.waitForTimeout(300);

    // 2. Submit. Ticket creation succeeds (real API), attachment upload fails.
    await page.click("button:has-text('Submit')");

    // 3. Assert the Case B state: success panel with Ticket Number + attachment failure.
    await page.waitForSelector(".success-panel", { timeout: 15000 });
    const ticketNumberEl = page.locator(".ticket-info-value").first();
    await expect(ticketNumberEl).toBeVisible();
    const ticketNumber = (await ticketNumberEl.textContent())?.trim() ?? "";
    expect(ticketNumber).toMatch(/TKT-\d{4}-\d{6}/);

    // The attachment failure is reported separately (Case B).
    await expect(page.locator(".case-b-note").first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator(".upload-failed").first()).toBeVisible({ timeout: 5000 });
    expect(uploadAttempts).toBeGreaterThanOrEqual(1);

    // 4. Open Ticket Detail — the failed attachment is shown with a Retry button.
    await page.click("button:has-text('View Ticket')");
    await page.waitForSelector(".ticket-detail", { timeout: 15000 });
    await expect(page.locator(".attachment-failed").first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator("button:has-text('Retry')").first()).toBeVisible({ timeout: 5000 });

    // 5. Retry the attachment — now let the upload succeed.
    await page.unroute(/\/api\/tickets\/TKT-\d{4}-\d{6}\/attachments$/);
    await page.locator("button:has-text('Retry')").first().click();

    // 6. Assert the retry succeeds: the attachment becomes active.
    await expect(page.locator(`.attachment-name:has-text('${fileName}')`).first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator(".attachment-status-active").first()).toBeVisible({ timeout: 5000 });
    // The failed row is gone.
    await expect(page.locator(".attachment-failed").first()).not.toBeVisible({ timeout: 5000 });

    // 7. Critical assertion: the Ticket Number is unchanged.
    await expect(page.locator(`text=${ticketNumber}`).first()).toBeVisible({ timeout: 5000 });

    // 8. Exactly one ticket with this identifier exists in My Tickets.
    //    Count only VISIBLE ticket-number links (the mobile cards are hidden
    //    via CSS on desktop but still present in the DOM).
    await page.click("a:has-text('My Tickets')");
    await openMyTickets(page);
    const ticketLinks = page.locator(`a:has-text('${ticketNumber}')`).filter({ visible: true });
    await expect(ticketLinks.first()).toBeVisible({ timeout: 10000 });
    expect(await ticketLinks.count()).toBe(1);

    await page.screenshot({
      path: "artifacts/lab-02/screenshots/e2e-04-partial-success.png",
      fullPage: true,
    });
  });
});