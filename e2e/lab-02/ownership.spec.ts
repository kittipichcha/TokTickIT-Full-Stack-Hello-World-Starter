import { test, expect } from "@playwright/test";
import {
  selectRequester,
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
 * the page happened not to render. The direct API checks use the real backend
 * with each requester's X-Dev-Requester-Id header and assert the canonical
 * 404 NOT_FOUND ownership response (BR-24 / api-spec §0).
 */
test.describe("E2E-02: Ownership isolation across two requester contexts", () => {
  test("Requester A and B cannot see or fetch each other's tickets", async ({ page }) => {
    const summaryA = `E2E-02 Requester A private ticket ${Date.now()}`;
    const summaryB = `E2E-02 Requester B private ticket ${Date.now()}`;
    const descA = "This ticket belongs to Requester A and must not be visible to Requester B.";
    const descB = "This ticket belongs to Requester B and must not be visible to Requester A.";

    // === Requester A creates a uniquely identifiable ticket A ===
    await selectRequester(page, "1");
    await openCreateTicket(page);
    const ticketNumberA = await createTicket(page, summaryA, descA);

    // === Switch to Requester B and create a uniquely identifiable ticket B ===
    await page.click("button:has-text('Change Requester')");
    await page.waitForSelector("#requester", { timeout: 10000 });
    await page.selectOption("#requester", "2");
    await page.click("button:has-text('Continue')");
    await page.waitForSelector(".app-shell", { timeout: 10000 });
    await openCreateTicket(page);
    const ticketNumberB = await createTicket(page, summaryB, descB);

    // === As Requester B: B ticket visible, A ticket NOT visible ===
    await openMyTickets(page);
    await expect(page.locator(`text=${summaryB}`).filter({ visible: true }).first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator(`text=${ticketNumberB}`).filter({ visible: true }).first()).toBeVisible({ timeout: 5000 });
    // A's ticket must NOT appear in B's list.
    await expect(page.locator(`text=${summaryA}`).filter({ visible: true }).first()).not.toBeVisible({ timeout: 5000 });
    await expect(page.locator(`text=${ticketNumberA}`).filter({ visible: true }).first()).not.toBeVisible({ timeout: 5000 });

    // === Switch back to Requester A: A ticket visible, B ticket NOT visible ===
    await page.click("button:has-text('Change Requester')");
    await page.waitForSelector("#requester", { timeout: 10000 });
    await page.selectOption("#requester", "1");
    await page.click("button:has-text('Continue')");
    await page.waitForSelector(".app-shell", { timeout: 10000 });
    await openMyTickets(page);
    await expect(page.locator(`text=${summaryA}`).filter({ visible: true }).first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator(`text=${ticketNumberA}`).filter({ visible: true }).first()).toBeVisible({ timeout: 5000 });
    // B's ticket must NOT appear in A's list.
    await expect(page.locator(`text=${summaryB}`).filter({ visible: true }).first()).not.toBeVisible({ timeout: 5000 });
    await expect(page.locator(`text=${ticketNumberB}`).filter({ visible: true }).first()).not.toBeVisible({ timeout: 5000 });

    // === Direct API ownership verification (real backend) ===
    // B cannot directly fetch A's ticket → 404 NOT_FOUND.
    const bFetchA = await page.request.get(
      `http://localhost:3000/api/tickets/${ticketNumberA}`,
      { headers: { "X-Dev-Requester-Id": "2" } },
    );
    expect(bFetchA.status()).toBe(404);
    const bFetchABody = await bFetchA.json();
    expect(bFetchABody.error.code).toBe("NOT_FOUND");

    // A cannot directly fetch B's ticket → 404 NOT_FOUND.
    const aFetchB = await page.request.get(
      `http://localhost:3000/api/tickets/${ticketNumberB}`,
      { headers: { "X-Dev-Requester-Id": "1" } },
    );
    expect(aFetchB.status()).toBe(404);
    const aFetchBBody = await aFetchB.json();
    expect(aFetchBBody.error.code).toBe("NOT_FOUND");

    // Sanity: each owner CAN fetch their own ticket → 200.
    const aFetchA = await page.request.get(
      `http://localhost:3000/api/tickets/${ticketNumberA}`,
      { headers: { "X-Dev-Requester-Id": "1" } },
    );
    expect(aFetchA.status()).toBe(200);
    const bFetchB = await page.request.get(
      `http://localhost:3000/api/tickets/${ticketNumberB}`,
      { headers: { "X-Dev-Requester-Id": "2" } },
    );
    expect(bFetchB.status()).toBe(200);

    await page.screenshot({
      path: "artifacts/lab-02/screenshots/e2e-02-ownership-isolation.png",
      fullPage: true,
    });
  });
});