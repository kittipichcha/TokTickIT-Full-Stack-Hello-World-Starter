import { test, expect, type Locator, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { PASSWORD, USERS, createRequesterTicket, login, navigate, resetAccount } from "../lab-03/helpers";

async function captureWorkflowState(page: Page, scope: Locator, state: string) {
  await scope.scrollIntoViewIfNeeded();
  await expect(scope).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await scope.locator("button").evaluateAll(nodes => nodes.every(node => {
    const bounds = node.getBoundingClientRect();
    return !bounds.width || (bounds.left >= -1 && bounds.right <= window.innerWidth + 1);
  }))).toBe(true);
  const directory = path.resolve("artifacts/lab-04/screenshots/workflow");
  mkdirSync(directory, { recursive: true });
  await page.screenshot({ path: path.join(directory, `${test.info().project.name}-${state}.png`), fullPage: state !== "resolved-confirmation" });
}

// E2E-01 workflow portion: exercise the real resolution gate and role projection.
test("Pending Actions block resolution until completed or cancelled; Requester remains read-only", async ({ page }) => {
  test.setTimeout(120_000);
  await resetAccount("requester");
  await resetAccount("staff");
  await resetAccount("adminPeer");
  const summary = `Issue 53 resolution ${Date.now()}`;
  await login(page, USERS.requester.email);
  const ticketNumber = await createRequesterTicket(page, summary);
  await page.getByRole("button", { name: "Logout" }).click();
  await login(page, USERS.staff.email);
  await navigate(page, "Ticket Queue");
  await page.getByLabel("Search tickets").fill(summary);
  await page.getByRole("button", { name: "Open Detail" }).click();
  await expect(page.getByRole("heading", { name: ticketNumber })).toBeVisible();
  const history = page.getByRole("region", { name: "Ticket status history" });
  await history.getByRole("button", { name: "View status history" }).click();
  await expect(history.getByText("No status history.", { exact: true })).toBeVisible();
  await captureWorkflowState(page, history, "history-empty");
  await history.getByRole("button", { name: "Hide status history" }).click();
  await page.getByRole("button", { name: "Claim / Reassign to me", exact: true }).click();
  const controls = page.locator("section").filter({ has: page.getByRole("heading", { name: "Ticket controls" }) });
  await controls.getByRole("button", { name: "Open", exact: true }).click();
  await controls.getByRole("button", { name: "In Progress", exact: true }).click();
  // Build more than one real history page without changing the resolution gate scenario.
  for (let index = 0; index < 4; index += 1) {
    await controls.getByRole("button", { name: "Waiting for Requester", exact: true }).click();
    await expect(page.locator(".status-badge").first()).toHaveText("WAITING_FOR_REQUESTER");
    await controls.getByRole("button", { name: "In Progress", exact: true }).click();
    await expect(page.locator(".status-badge").first()).toHaveText("IN_PROGRESS");
  }
  const actions = page.locator('section[aria-label="Actions Taken"]');
  for (const description of ["Resolution action A", "Resolution action B"]) {
    await actions.getByRole("button", { name: "Add Action" }).click();
    const form = page.locator('form[aria-label="Add Action"]');
    await form.locator("#action-description").fill(description);
    if (description === "Resolution action B") {
      await form.locator("#action-assignee").selectOption({ label: `${USERS.adminPeer.name} — Administrator` });
    }
    await form.getByRole("button", { name: "Record Action" }).click();
    await expect(actions.locator(".success-box")).toContainText("Action recorded successfully");
    await form.getByRole("button", { name: "Cancel" }).click();
  }
  await expect(actions.locator(".action-status-badge").filter({ hasText: "Pending" })).toHaveCount(2);
  // E2E-01's inactive-assignee rejection belongs to this same two-Action Ticket.
  const cardB = actions.locator("li.action-card").filter({ hasText: "Resolution action B" });
  await cardB.getByRole("button", { name: "Edit Action" }).click();
  const editB = page.locator('form[aria-label="Edit Action"]');
  await expect(editB.locator("#action-assignee")).toBeEnabled();
  try {
    await resetAccount("adminPeer", false, PASSWORD, false);
    await editB.locator("#action-description").fill("Resolution action B retained draft");
    const rejectedAssignment = page.waitForResponse(response => response.url().includes(`/tickets/${ticketNumber}/actions/`) && response.request().method() === "PATCH");
    await editB.getByRole("button", { name: "Save Action" }).click();
    expect((await rejectedAssignment).status()).toBe(409);
    await expect(editB.locator(".error-box")).toContainText("not an active IT Staff or Administrator");
    await expect(editB.locator("#action-description")).toHaveValue("Resolution action B retained draft");
    await expect(cardB.locator(".action-card-description")).toHaveText("Resolution action B");
    await expect(cardB.locator(".action-status-badge")).toHaveText("Pending");
    await editB.getByRole("button", { name: "Cancel", exact: true }).click();
  } finally {
    await resetAccount("adminPeer");
  }
  const blockedResponse = page.waitForResponse(response => response.url().endsWith(`/staff/tickets/${ticketNumber}/status`) && response.request().method() === "PATCH");
  await controls.getByRole("button", { name: "Resolved", exact: true }).click();
  const confirmation = page.getByRole("dialog", { name: "Confirm status change" });
  await expect(confirmation).toContainText("prevents new Actions until the Ticket is reopened");
  await captureWorkflowState(page, confirmation, "resolved-confirmation");
  await confirmation.getByRole("button", { name: "Confirm", exact: true }).click();
  expect((await blockedResponse).status()).toBe(409);
  await expect(page.locator(".error-box").first()).toContainText(/pending/i);
  await expect(page.locator(".status-badge").first()).toHaveText("IN_PROGRESS");
  for (const [description, status] of [["Resolution action A", "completed"], ["Resolution action B", "cancelled"]]) {
    const card = actions.locator("li.action-card").filter({ hasText: description });
    await card.getByRole("button", { name: "Edit Action" }).click();
    const form = page.locator('form[aria-label="Edit Action"]');
    if (status === "completed") await form.locator("#action-result").fill("Service restored and verified.");
    await form.locator(`#action-status-${status}`).check();
    await form.getByRole("button", { name: "Save Action" }).click();
    await expect(form).toHaveCount(0);
    await expect(card.locator(".action-status-badge")).toHaveText(status === "completed" ? "Completed" : "Cancelled");
  }
  await expect(actions.locator(".action-status-badge").filter({ hasText: "Pending" })).toHaveCount(0);
  await controls.getByRole("button", { name: "Resolved", exact: true }).click();
  await page.getByRole("dialog", { name: "Confirm status change" }).getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page.locator(".status-badge").first()).toHaveText("RESOLVED");
  await history.getByRole("button", { name: "View status history" }).click();
  await expect(history.getByText("Page 1 of 2", { exact: true })).toBeVisible();
  await captureWorkflowState(page, history, "history-page-1");
  const nextPage = history.getByRole("button", { name: "Next", exact: true });
  let releaseHistory!: () => void;
  const historyBarrier = new Promise<void>(resolve => { releaseHistory = resolve; });
  const historyRoute = `**/staff/tickets/${ticketNumber}/status-history?**`;
  await page.route(historyRoute, async route => {
    if (new URL(route.request().url()).searchParams.get("page") !== "2") return route.continue();
    const response = await route.fetch();
    await historyBarrier;
    await route.fulfill({ response });
  });
  try {
    await nextPage.focus();
    await page.keyboard.press("Enter");
    await expect(history.locator(".ticket-status-history-content")).toHaveAttribute("aria-busy", "true");
    await expect(nextPage).toBeFocused();
    await expect(history.getByText("Page 1 of 2", { exact: true })).toBeVisible();
    releaseHistory();
    const pageStatus = history.getByRole("status", { name: "Status history page" });
    await expect(pageStatus).toHaveText("Page 2 of 2");
    await expect(pageStatus).toBeFocused();
    await expect(nextPage).toBeDisabled();
    await captureWorkflowState(page, history, "history-page-2");
    const previousPage = history.getByRole("button", { name: "Previous", exact: true });
    await previousPage.focus();
    await page.keyboard.press("Enter");
    await expect(pageStatus).toHaveText("Page 1 of 2");
    await expect(pageStatus).toBeFocused();
  } finally {
    releaseHistory();
    await page.unroute(historyRoute);
  }
  // A presentation-only injected read failure retains the real previously fetched history.
  // Persistence and authorized visibility remain proved by the preceding real API journey.
  await page.route(historyRoute, route => route.fulfill({ status: 500, json: { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } } }));
  try {
    await nextPage.click();
    await expect(history.getByRole("alert")).toContainText("Unable to load status history.");
    await captureWorkflowState(page, history, "history-read-error");
    await page.unroute(historyRoute);
    await history.getByRole("button", { name: "Retry", exact: true }).click();
    await expect(history.getByRole("status", { name: "Status history page" })).toHaveText("Page 2 of 2");
    await expect(history.getByRole("alert")).toHaveCount(0);
  } finally {
    await page.unroute(historyRoute);
  }
  await page.getByRole("button", { name: "Logout" }).click();
  await login(page, USERS.requester.email);
  await navigate(page, "My Tickets");
  await page.getByRole("link", { name: ticketNumber }).click();
  await expect(page.locator(".status-badge").first()).toHaveText("RESOLVED");
  await expect(actions.locator("li.action-card")).toHaveCount(2);
  await expect(actions).toContainText(USERS.staff.name);
  await expect(actions).toContainText(USERS.adminPeer.name);
  await expect(actions).toContainText("Service restored and verified.");
  await expect(actions.getByRole("button", { name: /Add Action|Edit Action|Save Action/ })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Ticket controls" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Status history" })).toHaveCount(0);
});
