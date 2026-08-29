import { test, expect } from "@playwright/test";

/**
 * E2E-05: Keyboard-only requester selection and create-ticket flow with
 * visible focus indicators (AC-25).
 */
test.describe("E2E-05: Keyboard accessibility", () => {
  test("visible focus indicators on requester selector and Continue button", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("#requester", { timeout: 10000 });

    // Tab through the selector — focus should be visible
    await page.keyboard.press("Tab");
    // The select should receive focus
    const focusedSelect = page.locator("#requester");
    await expect(focusedSelect).toBeFocused();

    // Tab to Continue button
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
    await page.waitForSelector("input[aria-label*='Summary']", { timeout: 10000 });
  });

  test("focus indicator visible on form controls", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("#requester", { timeout: 10000 });

    await page.selectOption("#requester", "1");
    await page.click("button:has-text('Continue')");
    await page.waitForSelector(".app-shell", { timeout: 10000 });

    await page.click("a:has-text('Create Ticket')");
    await page.waitForSelector("input[aria-label*='Summary']", { timeout: 10000 });

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
});