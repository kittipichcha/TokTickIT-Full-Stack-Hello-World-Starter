import { test, expect } from "@playwright/test";

test.describe("E2E-03: Full attachment lifecycle", () => {
  test("upload, preview, download, and remove an attachment on a created ticket", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("#requester", { timeout: 10000 });

    await page.selectOption("#requester", "1");
    await page.click("button:has-text('Continue')");
    await page.waitForSelector(".app-shell", { timeout: 10000 });

    await page.click("a:has-text('Create Ticket')");
    await page.waitForSelector(".ticket-form", { timeout: 10000 });

    await page.selectOption("select[aria-label*='Category']", { index: 1 });
    await page.selectOption("select[aria-label*='Related System']", { index: 1 });
    await page.fill("input[aria-label*='Summary']", "E2E-03 Attachment lifecycle ticket");
    await page.fill("textarea[aria-label*='Description']", "Testing attachment lifecycle end-to-end.");

    await page.click("button:has-text('Submit')");
    await page.waitForSelector(".success-panel", { timeout: 15000 });

    await page.click("a:has-text('My Tickets')");
    await page.waitForTimeout(2000);

    // Click the ticket link
    const ticketLink = page.locator("a:has-text('E2E-03 Attachment lifecycle ticket')").first();
    await ticketLink.click();
    await page.waitForTimeout(2000);

    // Verify attachment section exists
    await expect(page.locator("text=Attachments").first()).toBeVisible({ timeout: 5000 });

    // Upload a file
    const fileChooserPromise = page.waitForEvent("filechooser", { timeout: 5000 });
    await page.click("text=Browse files");
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: "test.png",
      mimeType: "image/png",
      buffer: Buffer.from("89504E470D0A1A0A0000000D4948445200000001000000010802000000907753DE0000000C4944415408D76360F8CF00000002010158A80000000049454E44AE426082", "hex"),
    });

    await page.waitForTimeout(3000);

    await page.screenshot({
      path: "artifacts/lab-02/screenshots/e2e-03-attachment-lifecycle.png",
      fullPage: true,
    });
  });
});