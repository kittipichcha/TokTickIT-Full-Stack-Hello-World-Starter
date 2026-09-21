import { expect, type Page } from "@playwright/test";

/**
 * Shared helpers for the Lab 2 integration E2E specs.
 *
 * These helpers drive the REAL client + REAL API + REAL database (no route
 * interception). They centralize the stable DOM selectors so the integration
 * specs stay consistent and auditable against the actual UI.
 *
 * Issue #37 removed the Dev-Requester selector (`X-Dev-Requester-Id`). Identity is
 * now established by logging in through the real Login screen, so the former
 * `selectRequester` helper is replaced by `loginAsRequester`.
 */

/**
 * Test-only E2E Requester accounts (no real secrets).
 *
 * `global-setup.ts` upserts these accounts with `mustChangePassword = false` so the
 * suite can reach the application shell. The password is a test-only constant.
 */
export const E2E_REQUESTER_A = {
  email: "e2e-requester-a@example.com",
  password: "E2eTestPass123!xyz",
  name: "E2E Requester A",
} as const;

export const E2E_REQUESTER_B = {
  email: "e2e-requester-b@example.com",
  password: "E2eTestPass123!xyz",
  name: "E2E Requester B",
} as const;

/**
 * Maps the legacy selector ids ("1" / "2") used by the Lab 2 specs onto the two
 * seeded E2E Requester accounts, so callers change minimally.
 */
export function requesterAccount(id: "1" | "2"): typeof E2E_REQUESTER_A {
  return id === "1" ? E2E_REQUESTER_A : E2E_REQUESTER_B;
}

/**
 * Log in through the real Login screen and wait for the authenticated shell.
 *
 * Replaces the removed `selectRequester` helper: it fills the real email/password
 * inputs, submits, and waits for `.app-shell` (AuthGate renders it only once the
 * session is established).
 */
export async function loginAsRequester(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/");
  await page.waitForSelector("#login-email", { timeout: 10000 });
  await page.fill("#login-email", email);
  await page.fill("#login-password", password);
  await page.click("button:has-text('Login')");
  await page.waitForSelector(".app-shell", { timeout: 15000 });
}

/** Convenience: log in as one of the two seeded E2E Requesters by legacy id. */
export async function loginAsRequesterById(page: Page, id: "1" | "2"): Promise<void> {
  const account = requesterAccount(id);
  await loginAsRequester(page, account.email, account.password);
}

/** An authenticated API session (cookie + CSRF token) for direct request-context calls. */
export interface ApiSession {
  cookie: string;
  csrfToken: string;
}

/**
 * Creates an ISOLATED authenticated API request context for one Requester.
 *
 * Each context has its own cookie jar, so two Requesters can be authenticated
 * simultaneously for direct cross-identity ownership checks. Callers must
 * `dispose()` the returned context.
 *
 * Replaces the removed `X-Dev-Requester-Id` header: direct API ownership checks now
 * authenticate with a real session.
 */
export async function createApiSession(
  playwright: import("@playwright/test").Playwright,
  id: "1" | "2",
): Promise<import("@playwright/test").APIRequestContext> {
  const context = await playwright.request.newContext();
  const account = requesterAccount(id);
  const response = await context.post("http://localhost:3000/api/auth/login", {
    data: { email: account.email, password: account.password },
  });
  if (!response.ok()) {
    await context.dispose();
    throw new Error(`API login failed for ${account.email}: ${response.status()}`);
  }
  return context;
}

/** Navigate to the Create Ticket screen from the app shell. */
export async function openCreateTicket(page: Page): Promise<void> {
  // On mobile (<768px) the primary nav is behind the hamburger; open it if hidden.
  const nav = page.locator("#primary-navigation");
  if (await nav.isVisible().catch(() => false)) {
    await page.click("a:has-text('Create Ticket')");
  } else {
    await page.click(".hamburger");
    await page.click("a:has-text('Create Ticket')");
  }
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
  // On mobile (<768px) the primary nav is behind the hamburger; open it if hidden.
  const nav = page.locator("#primary-navigation");
  if (await nav.isVisible().catch(() => false)) {
    await page.click("a:has-text('My Tickets')");
  } else {
    await page.click(".hamburger");
    await page.click("a:has-text('My Tickets')");
  }
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