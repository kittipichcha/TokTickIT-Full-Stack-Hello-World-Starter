import { test, expect } from "@playwright/test";
import {
  loginAsRequesterById,
  createApiSession,
  openCreateTicket,
  createTicket,
  openMyTickets,
} from "./helpers";

/**
 * E2E-02: Ownership isolation across two requester contexts.
 *
 * Proves the full isolation contract:
 *   A → A ticket visible
 *   B → B ticket visible
 *   A cannot see B
 *   B cannot see A
 *   B cannot directly fetch A (direct API ownership verification)
 *   A cannot directly fetch B (direct API ownership verification)
 *
 * Unique ticket identifiers are used so a false positive cannot occur because
 * the page happened not to render. Issue #37 removed the Dev-Requester selector
 * and the `X-Dev-Requester-Id` header, so identity is now established by two
 * separate authenticated logins (UI) and two real API sessions (direct checks).
 * The direct API checks assert the canonical 404 NOT_FOUND ownership response
 * (BR-24 / api-spec §0).
 */
test.describe("E2E-02: Ownership isolation across two requester contexts", () => {
  test("Requester A and B cannot see or fetch each other's tickets", async ({ page, playwright }) => {
    const summaryA = `E2E-02 Requester A private ticket ${Date.now()}`;
    const summaryB = `E2E-02 Requester B private ticket ${Date.now()}`;
    const descA = "This ticket belongs to Requester A and must not be visible to Requester B.";
    const descB = "This ticket belongs to Requester B and must not be visible to Requester A.";

    // === Requester A creates a uniquely identifiable ticket A ===
    await loginAsRequesterById(page, "1");
    await openCreateTicket(page);
    const ticketNumberA = await createTicket(page, summaryA, descA);

    // === Log out, then log in as Requester B and create ticket B ===
    await page.click("button:has-text('Logout')");
    await page.waitForSelector("#login-email", { timeout: 10000 });
    await loginAsRequesterById(page, "2");
    await openCreateTicket(page);
    const ticketNumberB = await createTicket(page, summaryB, descB);

    // === As Requester B: B ticket visible, A ticket NOT visible ===
    await openMyTickets(page);
    await expect(page.locator(`text=${summaryB}`).filter({ visible: true }).first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator(`text=${ticketNumberB}`).filter({ visible: true }).first()).toBeVisible({ timeout: 5000 });
    // A's ticket must NOT appear in B's list.
    await expect(page.locator(`text=${summaryA}`).filter({ visible: true }).first()).not.toBeVisible({ timeout: 5000 });
    await expect(page.locator(`text=${ticketNumberA}`).filter({ visible: true }).first()).not.toBeVisible({ timeout: 5000 });

    // === Log out, log back in as Requester A: A ticket visible, B ticket NOT visible ===
    await page.click("button:has-text('Logout')");
    await page.waitForSelector("#login-email", { timeout: 10000 });
    await loginAsRequesterById(page, "1");
    await openMyTickets(page);
    await expect(page.locator(`text=${summaryA}`).filter({ visible: true }).first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator(`text=${ticketNumberA}`).filter({ visible: true }).first()).toBeVisible({ timeout: 5000 });
    // B's ticket must NOT appear in A's list.
    await expect(page.locator(`text=${summaryB}`).filter({ visible: true }).first()).not.toBeVisible({ timeout: 5000 });
    await expect(page.locator(`text=${ticketNumberB}`).filter({ visible: true }).first()).not.toBeVisible({ timeout: 5000 });

    // === Direct API ownership verification (real backend, isolated sessions) ===
    // Each Requester gets its own request context (separate cookie jar) so both
    // identities stay authenticated at the same time.
    const apiA = await createApiSession(playwright, "1");
    const apiB = await createApiSession(playwright, "2");
    try {
      // B cannot directly fetch A's ticket → 404 NOT_FOUND.
      const bFetchA = await apiB.get(`http://localhost:3000/api/tickets/${ticketNumberA}`);
      expect(bFetchA.status()).toBe(404);
      const bFetchABody = await bFetchA.json();
      expect(bFetchABody.error.code).toBe("NOT_FOUND");

      // A cannot directly fetch B's ticket → 404 NOT_FOUND.
      const aFetchB = await apiA.get(`http://localhost:3000/api/tickets/${ticketNumberB}`);
      expect(aFetchB.status()).toBe(404);
      const aFetchBBody = await aFetchB.json();
      expect(aFetchBBody.error.code).toBe("NOT_FOUND");

      // Sanity: each owner CAN fetch their own ticket → 200.
      const aFetchA = await apiA.get(`http://localhost:3000/api/tickets/${ticketNumberA}`);
      expect(aFetchA.status()).toBe(200);
      const bFetchB = await apiB.get(`http://localhost:3000/api/tickets/${ticketNumberB}`);
      expect(bFetchB.status()).toBe(200);
    } finally {
      await apiA.dispose();
      await apiB.dispose();
    }

    await page.screenshot({
      path: "artifacts/lab-02/screenshots/e2e-02-ownership-isolation.png",
      fullPage: true,
    });
  });
});