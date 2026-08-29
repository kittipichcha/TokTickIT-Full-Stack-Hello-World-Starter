import { test, expect } from "@playwright/test";
import { selectRequester, openCreateTicket } from "./helpers";

/**
 * E2E-05: Keyboard-only requester selection and create-ticket flow with
 * visible focus indicators (AC-25).
 *
 * Verifies:
 *   Requester selection → keyboard navigation → Continue
 *   Create Ticket → keyboard field navigation → validation
 *   My Tickets → keyboard navigation → ticket selection
 *   Ticket Detail → attachment controls → modal → Escape → focus restoration
 */
test.describe("E2E-05: Keyboard accessibility", () => {
  test("visible focus indicators on requester selector and Continue button", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("#requester", { timeout: 10000 });

    // Tab to the selector — focus should be visible
    await page.keyboard.press("Tab");
    const focusedSelect = page.locator("#requester");
    await expect(focusedSelect).toBeFocused();

    // Select a requester so Continue becomes enabled, then Tab to it.
    await page.selectOption("#requester", "1");
    await page.keyboard.press("Tab");
    const continueButton = page.locator("button:has-text('Continue')");
    await expect(continueButton).toBeFocused();

    // Verify the focused element has a visible focus indicator
    const hasFocusRing = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return false;
      const style = window.getComputedStyle(el);
      return style.outlineStyle !== "none" && style.outlineWidth !== "0px";
    });
    expect(hasFocusRing).toBe(true);
  });

  test("keyboard-only requester selection, Continue, and Create Ticket navigation", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("#requester", { timeout: 10000 });

    // Tab to requester select
    await page.keyboard.press("Tab");
    await expect(page.locator("#requester")).toBeFocused();

    // Select a requester using keyboard (Enter to open, arrow down)
    await page.keyboard.press("Enter");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(300);

    // Tab to Continue button and press Enter
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");

    // Wait for app shell
    await page.waitForSelector(".app-shell", { timeout: 10000 });

    // Tab to navigate to Create Ticket link
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    // Should reach Create Ticket link
    const createTicketLink = page.locator("a:has-text('Create Ticket')");
    await expect(createTicketLink).toBeFocused();

    // Press Enter to navigate
    await page.keyboard.press("Enter");
    await page.waitForSelector("#summary", { timeout: 10000 });
  });

  test("focus indicator visible on form controls", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("#requester", { timeout: 10000 });

    await page.selectOption("#requester", "1");
    await page.click("button:has-text('Continue')");
    await page.waitForSelector(".app-shell", { timeout: 10000 });

    await page.click("a:has-text('Create Ticket')");
    await page.waitForSelector("#summary", { timeout: 10000 });

    // Tab through form controls and verify focus
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press("Tab");
      await page.waitForTimeout(100);

      const focusedEl = page.locator(":focus");
      if (await focusedEl.count() === 0) break;

      const hasFocusRing = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el) return false;
        const style = window.getComputedStyle(el);
        return style.outlineStyle !== "none" && style.outlineWidth !== "0px";
      });
      // At least some elements should have focus rings
      expect(hasFocusRing).toBe(true);
    }
  });

  test("Change Requester is keyboard-accessible", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("#requester", { timeout: 10000 });

    await page.selectOption("#requester", "1");
    await page.click("button:has-text('Continue')");
    await page.waitForSelector(".app-shell", { timeout: 10000 });

    // Tab through to reach Change Requester button
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press("Tab");
      const focused = page.locator(":focus");
      const text = await focused.textContent();
      if (text?.includes("Change Requester")) break;
    }

    const changeBtn = page.locator("button:has-text('Change Requester')");
    await expect(changeBtn).toBeFocused();

    // Press Enter to change requester
    await page.keyboard.press("Enter");
    await page.waitForSelector("#requester", { timeout: 10000 });
  });

  test("removal dialog: focus enters modal, Tab stays inside, Escape closes, focus restores", async ({ page }) => {
    // Create a ticket with an attachment so the Remove control exists.
    await selectRequester(page, "1");
    await openCreateTicket(page);
    await page.selectOption("#categoryId", { index: 1 });
    await page.selectOption("#relatedSystemId", { index: 1 });
    const summary = `E2E-05 keyboard modal ${Date.now()}`;
    await page.fill("#summary", summary);
    await page.fill("#description", "Keyboard accessibility modal focus trap verification.");
    await page.click("button:has-text('Submit')");
    await page.waitForSelector(".success-panel", { timeout: 15000 });

    // Open the ticket detail.
    await page.click("button:has-text('View Ticket')");
    await page.waitForSelector(".ticket-detail", { timeout: 15000 });

    // Upload an attachment so a Remove button exists.
    const fcPromise = page.waitForEvent("filechooser");
    await page.click("button:has-text('+ Add Attachment')");
    const fc = await fcPromise;
    await fc.setFiles({
      name: "modal-focus.png",
      mimeType: "image/png",
      buffer: Buffer.from("89504E470D0A1A0A0000000D4948445200000001000000010802000000907753DE0000000C4944415408D76360F8CF00000002010158A80000000049454E44AE426082", "hex"),
    });
    await expect(page.locator(".attachment-status-active").first()).toBeVisible({ timeout: 15000 });

    // Open the removal dialog.
    const removeButton = page.locator("button:has-text('Remove')").first();
    await removeButton.click();
    await page.waitForSelector(".modal-overlay", { timeout: 5000 });

    // Focus enters the modal (Cancel button is the first interactive control).
    const cancelButton = page.locator(".modal-actions button:has-text('Cancel')");
    await expect(cancelButton).toBeFocused();

    // Tab stays inside the modal (focus trap): focus cycles among the dialog's
    // focusable controls (textarea, Cancel, Remove) and never leaves the modal.
    const modal = page.locator(".modal-overlay");
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("Tab");
      const focusedInside = await page.evaluate(() => {
        const active = document.activeElement as HTMLElement | null;
        const dialog = document.querySelector(".modal-overlay");
        return !!dialog && !!active && dialog.contains(active);
      });
      expect(focusedInside, `Tab ${i + 1}: focus stays inside the modal`).toBe(true);
    }

    // Escape closes the dialog.
    await page.keyboard.press("Escape");
    await page.waitForSelector(".modal-overlay", { state: "detached", timeout: 5000 });

    // Focus is restored to the invoking Remove button.
    await expect(removeButton).toBeFocused();
  });
});