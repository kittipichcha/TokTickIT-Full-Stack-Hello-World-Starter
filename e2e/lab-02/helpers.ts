import { expect, type Page } from "@playwright/test";

/**
 * Shared helpers for the Lab 2 integration E2E specs.
 *
 * These helpers drive the REAL client + REAL API + REAL database (no route
 * interception). They centralize the stable DOM selectors so the integration
 * specs stay consistent and auditable against the actual UI.
 */

/** Select a development requester on the selector screen and continue. */
export async function selectRequester(page: Page, requesterId: string): Promise<void> {
  await page.goto("/");
  await page.waitForSelector(".requester-option", { timeout: 10000 });
  await page.click(`.requester-option[aria-label="Select ${requesterNameForId(requesterId)}"]`);
  await page.click("button:has-text('Continue')");
  await page.waitForSelector(".app-shell", { timeout: 10000 });
}

/** Map a requester id to its display name for the selector option aria-label. */
function requesterNameForId(requesterId: string): string {
  const names: Record<string, string> = {
    "1": "Ada Lovelace",
    "2": "Grace Hopper",
    "3": "Katherine Johnson",
    "4": "Alan Turing",
  };
  return names[requesterId] ?? "Ada Lovelace";
}

/** Navigate to the Create Ticket screen from the app shell. */
export async function openCreateTicket(page: Page): Promise<void> {
  await page.click("a:has-text('Create Ticket')");
  await page.waitForSelector(".ticket-form", { timeout: 10000 });
}

/**
 * Fill the Create Ticket form with valid values and submit.
 * Returns the generated ticket number extracted from the success panel.
 */
export async function createTicket(
  page: Page,
  summary: string,
  description: string,
): Promise<string> {
  await page.selectOption("#categoryId", { index: 1 });
  await page.selectOption("#relatedSystemId", { index: 1 });
  await page.fill("#summary", summary);
  await page.fill("#description", description);
  await page.click("button:has-text('Submit')");
  await page.waitForSelector(".success-panel", { timeout: 15000 });

  const ticketNumberEl = page.locator(".ticket-info-value").first();
  await expect(ticketNumberEl).toBeVisible();
  const ticketNumber = (await ticketNumberEl.textContent())?.trim() ?? "";
  expect(ticketNumber).toMatch(/TKT-\d{4}-\d{6}/);
  return ticketNumber;
}

/** Navigate to My Tickets and wait for the list to load. */
export async function openMyTickets(page: Page): Promise<void> {
  await page.click("a:has-text('My Tickets')");
  // Wait for either a loaded table/cards, empty state, or no-results state.
  // Use :visible so the hidden desktop table on mobile / hidden mobile cards
  // on desktop do not satisfy the wait prematurely.
  await page.waitForSelector(
    ".tickets-table:visible, .tickets-cards:visible, .my-tickets-empty:visible, .my-tickets-no-results:visible, .error-box:visible",
    { timeout: 15000 },
  );
}

/** Search My Tickets for a deterministic term and wait for the result. */
export async function searchMyTickets(page: Page, term: string): Promise<void> {
  const searchInput = page.locator("input[aria-label='Search tickets']");
  await searchInput.fill(term);
  await page.waitForTimeout(500);
}

/**
 * Open a ticket from My Tickets by its summary text.
 *
 * The summary is rendered as plain text in a table cell / card, while the
 * ticket number is the clickable link. We locate the row/card containing the
 * summary and click the ticket-number link within it.
 */
export async function openTicketBySummary(page: Page, summary: string): Promise<void> {
  const row = page
    .locator("tr:visible, .ticket-card:visible")
    .filter({ hasText: summary })
    .first();
  await row.waitFor({ state: "visible", timeout: 10000 });
  const link = row.locator("a").first();
  await link.click();
  await page.waitForSelector(".ticket-detail", { timeout: 15000 });
}

/** A valid tiny PNG buffer for attachment uploads. */
export const VALID_PNG_BUFFER = Buffer.from(
  "89504E470D0A1A0A0000000D4948445200000001000000010802000000907753DE0000000C4944415408D76360F8CF00000002010158A80000000049454E44AE426082",
  "hex",
);