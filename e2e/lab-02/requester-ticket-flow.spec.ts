import { test, expect } from "@playwright/test";
import {
  selectRequester,
  openCreateTicket,
  createTicket,
  openMyTickets,
  searchMyTickets,
  openTicketBySummary,
} from "./helpers";

/**
 * E2E-01: Requester creates a ticket and later finds it in My Tickets.
 *
 * This establishes the fundamental integration chain:
 *   Requester → Create Ticket → API persistence → My Tickets → Search → Ticket appears
 *
 * It uses a deterministic unique summary so a false positive cannot occur
 * because the page happened not to render. It extracts the actual generated
 * Ticket Number and proves the ticket created DURING this test can be found.
 */
test.describe("E2E-01: Requester creates ticket and finds it in My Tickets", () => {
  test("full requester flow: select requester → create ticket → find in My Tickets", async ({ page }) => {
    const uniqueSummary = `E2E-01 integration ticket ${Date.now()}`;
    const description = "This ticket was created by an automated Playwright E2E test and must be findable.";

    // 1. Establish requester context.
    await selectRequester(page, "1");

    // 2. Create the ticket.
    await openCreateTicket(page);
    const ticketNumber = await createTicket(page, uniqueSummary, description);

    // 3. Navigate to My Tickets and assert the ticket exists.
    await openMyTickets(page);
    await expect(page.locator(`text=${uniqueSummary}`).filter({ visible: true }).first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator(`text=${ticketNumber}`).filter({ visible: true }).first()).toBeVisible({ timeout: 5000 });

    // 4. Search using a deterministic unique field and assert the exact ticket appears.
    await searchMyTickets(page, uniqueSummary);
    await expect(page.locator(`text=${uniqueSummary}`).filter({ visible: true }).first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator(`text=${ticketNumber}`).filter({ visible: true }).first()).toBeVisible({ timeout: 5000 });

    // 5. Open the ticket to prove the round trip continues into detail.
    await openTicketBySummary(page, uniqueSummary);
    await expect(page.locator(".ticket-detail")).toBeVisible();
    await expect(page.locator(`text=${ticketNumber}`).filter({ visible: true }).first()).toBeVisible({ timeout: 5000 });

    await page.screenshot({
      path: "artifacts/lab-02/screenshots/e2e-01-ticket-created.png",
      fullPage: true,
    });
  });
});