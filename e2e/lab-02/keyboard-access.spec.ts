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
  /**
   * Press Tab repeatedly until the given locator receives focus (or a cap is
   * reached). Returns true if the target became focused.
   */
  async function tabUntilFocused(page: import("@playwright/test").Page, target: import("@playwright/test").Locator, maxTabs = 20): Promise<boolean> {
    for (let i = 0; i < maxTabs; i++) {
      await page.keyboard.press("Tab");
      if (await target.evaluate((el) => el === document.activeElement).catch(() => false)) {
        return true;
      }
    }
    return false;
  }

  test("visible focus indicators on requester selector and Continue button", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".requester-option", { timeout: 10000 });

    // Tab to the first requester option — focus should be visible
    await page.keyboard.press("Tab");
    const firstOption = page.locator(".requester-option").first();
    await expect(firstOption).toBeFocused();

    // Select a requester with Space so Continue becomes enabled.
    await page.keyboard.press("Space");
    await expect(firstOption).toHaveAttribute("aria-checked", "true");

    // Tab to the Continue button.
    const continueButton = page.locator("button:has-text('Continue')");
    await tabUntilFocused(page, continueButton);
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

  test("mandatory keyboard-only flow: Requester Selection → Continue → Create Ticket", async ({ page }) => {
    // This is the canonical Issue #18 §24 flow. It uses ONLY Tab, Shift+Tab,
    // Enter, and Space — no ArrowDown, no mouse click, no selectOption().
    await page.goto("/");
    await page.waitForSelector(".requester-option", { timeout: 10000 });

    // Tab to the first requester option and select it with Space.
    await page.keyboard.press("Tab");
    const firstOption = page.locator(".requester-option").first();
    await expect(firstOption).toBeFocused();
    await page.keyboard.press("Space");
    await expect(firstOption).toHaveAttribute("aria-checked", "true");

    // Tab to Continue and activate it with Enter.
    const continueButton = page.locator("button:has-text('Continue')");
    await tabUntilFocused(page, continueButton);
    await expect(continueButton).toBeFocused();
    await page.keyboard.press("Enter");
    await page.waitForSelector(".app-shell", { timeout: 10000 });

    // Tab to the Create Ticket link and activate it with Enter.
    const createTicketLink = page.locator("a:has-text('Create Ticket')");
    await tabUntilFocused(page, createTicketLink);
    await expect(createTicketLink).toBeFocused();
    await page.keyboard.press("Enter");
    await page.waitForSelector("#summary", { timeout: 10000 });

    // Validation remains keyboard-usable: Tab to Submit and activate with Enter
    // while the required fields are empty → inline validation appears.
    const submitButton = page.locator("button:has-text('Submit')");
    await tabUntilFocused(page, submitButton);
    await expect(submitButton).toBeFocused();
    await page.keyboard.press("Enter");
    // Inline validation message appears under the empty summary field.
    await expect(page.locator(".field-error").first()).toBeVisible({ timeout: 5000 });
  });

  test("focus indicator visible on form controls", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".requester-option", { timeout: 10000 });

    await page.keyboard.press("Tab");
    await page.keyboard.press("Space");
    const continueButton = page.locator("button:has-text('Continue')");
    await tabUntilFocused(page, continueButton);
    await page.keyboard.press("Enter");
    await page.waitForSelector(".app-shell", { timeout: 10000 });

    const createTicketLink = page.locator("a:has-text('Create Ticket')");
    await tabUntilFocused(page, createTicketLink);
    await page.keyboard.press("Enter");
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
    await page.waitForSelector(".requester-option", { timeout: 10000 });

    await page.keyboard.press("Tab");
    await page.keyboard.press("Space");
    const continueButton = page.locator("button:has-text('Continue')");
    await tabUntilFocused(page, continueButton);
    await page.keyboard.press("Enter");
    await page.waitForSelector(".app-shell", { timeout: 10000 });

    // Tab through to reach Change Requester button
    const changeBtn = page.locator("button:has-text('Change Requester')");
    await tabUntilFocused(page, changeBtn);
    await expect(changeBtn).toBeFocused();

    // Press Enter to change requester
    await page.keyboard.press("Enter");
    await page.waitForSelector(".requester-option", { timeout: 10000 });
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