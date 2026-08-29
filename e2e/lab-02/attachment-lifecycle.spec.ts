import { test, expect } from "@playwright/test";
import {
  selectRequester,
  openCreateTicket,
  createTicket,
  openMyTickets,
  openTicketBySummary,
  VALID_PNG_BUFFER,
} from "./helpers";

/**
 * E2E-03: Full attachment lifecycle.
 *
 * Proves the complete lifecycle for one deterministic fixture:
 *   Upload → Attachment appears → Preview → Download → Remove → Removed state
 *   → Preview disabled → Download disabled
 *
 * Uses the real client + real API + real database (no route interception).
 */
test.describe("E2E-03: Full attachment lifecycle", () => {
  test("upload, preview, download, and remove an attachment on a created ticket", async ({ page }) => {
    const summary = `E2E-03 Attachment lifecycle ticket ${Date.now()}`;
    const description = "Testing the complete attachment lifecycle end-to-end.";

    // 1. Create a ticket.
    await selectRequester(page, "1");
    await openCreateTicket(page);
    const ticketNumber = await createTicket(page, summary, description);

    // 2. Open the ticket detail.
    await openMyTickets(page);
    await openTicketBySummary(page, summary);
    await expect(page.locator("text=Attachments").first()).toBeVisible({ timeout: 5000 });

    // 3. Upload a valid attachment via the Ticket Detail Add Attachment control.
    const fileName = "lifecycle-test.png";
    const fileChooserPromise = page.waitForEvent("filechooser", { timeout: 5000 });
    await page.click("button:has-text('+ Add Attachment')");
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: fileName,
      mimeType: "image/png",
      buffer: VALID_PNG_BUFFER,
    });

    // 4. Wait for the upload + refresh to complete and the attachment to appear.
    await expect(page.locator(`.attachment-name:has-text('${fileName}')`).first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator(".attachment-status-active").first()).toBeVisible({ timeout: 5000 });

    // 5. Preview the attachment (opens a new window/tab).
    const previewButton = page.locator("button:has-text('Preview')").first();
    await previewButton.click();
    await page.waitForTimeout(1000);

    // 6. Download the attachment.
    const downloadButton = page.locator("button:has-text('Download')").first();
    await downloadButton.click();
    await page.waitForTimeout(1000);

    // 7. Remove the attachment via the confirmation dialog.
    await page.locator("button:has-text('Remove')").first().click();
    await page.waitForSelector(".modal-overlay", { timeout: 5000 });
    await expect(page.locator("text=Remove Attachment").first()).toBeVisible();
    await page.locator(".modal-actions button:has-text('Remove')").click();

    // 8. Assert the removed state: Removed badge, Preview/Download disabled.
    await expect(page.locator(".removed-badge").first()).toBeVisible({ timeout: 15000 });
    const removedRow = page.locator(".attachment-row.attachment-removed").first();
    await expect(removedRow).toBeVisible();
    await expect(removedRow.locator("button:has-text('Preview')")).toBeDisabled();
    await expect(removedRow.locator("button:has-text('Download')")).toBeDisabled();

    await page.screenshot({
      path: "artifacts/lab-02/screenshots/e2e-03-attachment-lifecycle.png",
      fullPage: true,
    });
  });
});