import { expect, type Page } from "@playwright/test";

export const PASSWORD = "E2eTestPass123!xyz";
export const CHANGED_PASSWORD = "E2eChangedPass456!abc";

export const USERS = {
  requester: { email: "e2e-42-requester@example.com", name: "Issue 42 Requester", role: "REQUESTER" },
  otherRequester: { email: "e2e-42-other@example.com", name: "Issue 42 Other Requester", role: "REQUESTER" },
  staff: { email: "e2e-42-staff@example.com", name: "Issue 42 Staff", role: "IT_STAFF" },
  admin: { email: "e2e-42-admin@example.com", name: "Issue 42 Admin", role: "ADMINISTRATOR" },
  adminPeer: { email: "e2e-42-admin-peer@example.com", name: "Issue 42 Admin Peer", role: "ADMINISTRATOR" },
  forced: { email: "e2e-42-forced@example.com", name: "Issue 42 Forced Change", role: "REQUESTER" },
} as const;

export async function login(page: Page, email: string, password = PASSWORD): Promise<void> {
  await page.goto("/");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Login" }).click();
}

export async function expectAppShell(page: Page): Promise<void> {
  await expect(page.locator(".app-shell")).toBeVisible();
}

export async function navigate(page: Page, label: string): Promise<void> {
  const nav = page.locator("#primary-navigation");
  if (!(await nav.isVisible())) await page.locator(".hamburger").click();
  await page.getByRole("link", { name: label, exact: true }).click();
}

export async function createRequesterTicket(page: Page, summary: string): Promise<string> {
  await navigate(page, "Create Ticket");
  await page.locator("#categoryId").selectOption({ index: 1 });
  await page.locator("#relatedSystemId").selectOption({ index: 1 });
  await page.locator("#summary").fill(summary);
  await page.locator("#description").fill("Issue 42 integrated verification ticket description.");
  await page.getByRole("button", { name: "Submit" }).click();
  const ticketNumber = (await page.locator(".ticket-info-value").first().innerText()).trim();
  expect(ticketNumber).toMatch(/^TKT-\d{4}-\d{6}$/);
  return ticketNumber;
}
