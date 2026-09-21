import { test, expect } from "@playwright/test";
import { loginAsRequesterById, E2E_REQUESTER_A, openCreateTicket } from "./helpers";

/**
 * E2E-05: Keyboard-only login and create-ticket flow with visible focus
 * indicators (AC-25).
 *
 * Verifies:
 *   Login → keyboard navigation → authenticated shell
 *   Create Ticket → keyboard field navigation → validation
 *   My Tickets → keyboard navigation → ticket selection
 *   Ticket Detail → attachment controls → modal → Escape → focus restoration
 *
 * Issue #37 removed the Dev-Requester selector, so the former selector-focused
 * tests now exercise the real Login screen and the Logout control.
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

  /**
   * On mobile (<768px) the primary navigation is hidden behind the hamburger
   * until it is opened. This helper opens the hamburger (keyboard-only, Enter)
   * when the nav is not visible, so the nav links become focusable. On
   * desktop/tablet the nav is always visible and this is a no-op.
   */
  async function openNavIfHidden(page: import("@playwright/test").Page): Promise<void> {
    const nav = page.locator("#primary-navigation");
    if (await nav.isVisible().catch(() => false)) return;
    const hamburger = page.locator(".hamburger");
    await tabUntilFocused(page, hamburger);
    await page.keyboard.press("Enter");
    await expect(nav).toBeVisible();
  }

  test("visible focus indicators on the Login form controls", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("#login-email", { timeout: 10000 });

    // Tab to the email field — focus should be visible.
    const emailInput = page.locator("#login-email");
    await tabUntilFocused(page, emailInput);
    await expect(emailInput).toBeFocused();

    // Verify the focused element has a visible focus indicator.
    const hasFocusRing = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return false;
      const style = window.getComputedStyle(el);
      return style.outlineStyle !== "none" && style.outlineWidth !== "0px";
    });
    expect(hasFocusRing).toBe(true);
  });

  test("mandatory keyboard-only flow: Login → Create Ticket", async ({ page }) => {
    // This is the canonical keyboard-only flow. It uses Tab, Shift+Tab, Enter,
    // and Space — no mouse click and no fill().
    await page.goto("/");
    await page.waitForSelector("#login-email", { timeout: 10000 });

    // Fill the credentials with the keyboard.
    await page.locator("#login-email").focus();
    await page.keyboard.type(E2E_REQUESTER_A.email);
    await page.keyboard.press("Tab");
    await page.keyboard.type(E2E_REQUESTER_A.password);

    // Tab to the Login button and activate it with Enter.
    const loginButton = page.locator("button:has-text('Login')");
    await page.keyboard.press("Tab");
    await expect(loginButton).toBeFocused();
    await page.keyboard.press("Enter");
    await page.waitForSelector(".app-shell", { timeout: 15000 });

    // On mobile the primary nav is behind the hamburger; open it if hidden so
    // the Create Ticket link is focusable.
    await openNavIfHidden(page);

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
    await loginAsRequesterById(page, "1");

    // On mobile the primary nav is behind the hamburger; open it if hidden so
    // the Create Ticket link is focusable.
    await openNavIfHidden(page);

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

  test("Logout is keyboard-accessible", async ({ page }) => {
    await loginAsRequesterById(page, "1");

    // Tab through to reach the Logout button in the AuthGate header.
    const logoutBtn = page.locator("button:has-text('Logout')");
    await tabUntilFocused(page, logoutBtn);
    await expect(logoutBtn).toBeFocused();

    // Press Enter to log out → returns to the Login screen.
    await page.keyboard.press("Enter");
    await page.waitForSelector("#login-email", { timeout: 10000 });
  });

  test("removal dialog: focus enters modal, Tab stays inside, Escape closes, focus restores", async ({ page }) => {
    // Create a ticket with an attachment so the Remove control exists.
    await loginAsRequesterById(page, "1");
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