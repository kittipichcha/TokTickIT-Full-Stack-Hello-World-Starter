import { test, expect, type Locator, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { USERS, createRequesterTicket, login, navigate, resetAccount } from "../lab-03/helpers";

/** Local copy of the Lab 3 helper (not exported from `../lab-03/helpers`). */
async function expectControlInViewport(page: Page, control: Locator): Promise<void> {
  control = control.first();
  await control.scrollIntoViewIfNeeded();
  await expect(control).toBeVisible();
  const bounds = await control.boundingBox();
  const viewport = page.viewportSize()!;
  // 1px tolerance absorbs sub-pixel scroll rounding (e.g. 800.39 vs 800);
  // real clipping/overflow is far larger than this.
  const tolerance = 1;
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(-tolerance);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width + tolerance);
  expect(bounds!.y).toBeGreaterThanOrEqual(-tolerance);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height + tolerance);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
}

function screenshot(folder: string, file: string): string {
  const directory = path.resolve(`artifacts/lab-04/screenshots/${folder}`);
  mkdirSync(directory, { recursive: true });
  return path.join(directory, `${test.info().project.name}-${file}.png`);
}

/**
 * VISUAL-01 — Actions area portion (Issue #52).
 *
 * Desktop/tablet/mobile snapshots of the Actions area on both the Staff and
 * Requester Ticket Detail surfaces, asserting no clipping, no overlap and no
 * page-level horizontal overflow.
 */
test.describe("VISUAL-01 (Actions portion): Actions area responsive layout", () => {
  // Two logins + ticket creation + Action creation exceeds the 30s default.
  test.setTimeout(90_000);

  test.beforeEach(async () => {
    await resetAccount("requester");
    await resetAccount("staff");
    await resetAccount("adminPeer");
  });

  test("Staff Actions area keeps section, controls, and cards inside the viewport", async ({ page }) => {
    const summary = `Issue 52 visual staff ${Date.now()}`;
    await login(page, USERS.requester.email);
    await createRequesterTicket(page, summary);
    await page.getByRole("button", { name: "Logout" }).click();

    await login(page, USERS.staff.email);
    await navigate(page, "Ticket Queue");
    await page.getByLabel("Search tickets").fill(summary);
    await page.getByRole("button", { name: "Open Detail" }).click();
    await expect(page.getByRole("heading", { name: /^TKT-/ })).toBeVisible();

    const actionsSection = page.locator('section[aria-label="Actions Taken"]');
    await expect(actionsSection).toBeVisible();
    await expectControlInViewport(page, actionsSection.getByRole("heading", { name: "Actions Taken" }));
    await expectControlInViewport(page, actionsSection.getByRole("button", { name: "Add Action" }));

    // Give the snapshot a real card to prove card layout does not overflow.
    await actionsSection.getByRole("button", { name: "Add Action" }).click();
    const createForm = page.locator('form[aria-label="Add Action"]');
    await expect(createForm).toBeVisible();
    await expectControlInViewport(page, createForm.locator("#action-description"));
    await expectControlInViewport(page, createForm.locator("#action-assignee"));
    await createForm.locator("#action-description").fill("Responsive smoke Action for VISUAL-01.");
    await createForm.getByRole("button", { name: "Record Action" }).click();
    await expect(actionsSection.locator(".success-box")).toContainText(
      "Action recorded successfully",
    );
    await createForm.getByRole("button", { name: "Cancel" }).click();
    await expect(createForm).toHaveCount(0);

    const card = actionsSection
      .locator("li.action-card")
      .filter({ hasText: "Responsive smoke Action for VISUAL-01." });
    await expect(card).toBeVisible();
    await expectControlInViewport(page, card.locator(".action-status-badge"));
    // A freshly created Action is Pending, so its footer control is Edit Action.
    await expectControlInViewport(page, card.getByRole("button", { name: "Edit Action" }));

    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);

    await page.screenshot({ path: screenshot("actions-taken", "staff-actions"), fullPage: true });
  });

  test("Requester read-only Actions area keeps cards inside the viewport", async ({ page }) => {
    const summary = `Issue 52 visual requester ${Date.now()}`;
    await login(page, USERS.requester.email);
    const ticketNumber = await createRequesterTicket(page, summary);
    await page.getByRole("button", { name: "Logout" }).click();

    await login(page, USERS.staff.email);
    await navigate(page, "Ticket Queue");
    await page.getByLabel("Search tickets").fill(summary);
    await page.getByRole("button", { name: "Open Detail" }).click();
    const staffSection = page.locator('section[aria-label="Actions Taken"]');
    await staffSection.getByRole("button", { name: "Add Action" }).click();
    const createForm = page.locator('form[aria-label="Add Action"]');
    await createForm.locator("#action-description").fill("Read-only snapshot Action for VISUAL-01.");
    await createForm.getByRole("button", { name: "Record Action" }).click();
    await expect(staffSection.locator(".success-box")).toContainText(
      "Action recorded successfully",
    );
    await createForm.getByRole("button", { name: "Cancel" }).click();
    await page.getByRole("button", { name: "Logout" }).click();

    await login(page, USERS.requester.email);
    await navigate(page, "My Tickets");
    await page.getByRole("link", { name: ticketNumber }).click();

    const requesterSection = page.locator('section[aria-label="Actions Taken"]');
    await expect(requesterSection).toBeVisible();
    await expectControlInViewport(
      page,
      requesterSection.getByRole("heading", { name: "Actions Taken" }),
    );

    const card = requesterSection
      .locator("li.action-card")
      .filter({ hasText: "Read-only snapshot Action for VISUAL-01." });
    await expect(card).toBeVisible();
    await expectControlInViewport(page, card.locator(".action-status-badge"));
    await expectControlInViewport(
      page,
      card.locator(".action-field").filter({ hasText: "Performed by" }),
    );

    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);

    await page.screenshot({
      path: screenshot("actions-taken", "requester-actions"),
      fullPage: true,
    });
  });
});

async function expectDashboardGeometry(page: Page) {
  const result = await page.locator(".dashboard").evaluate(root => {
    const nodes = [...root.querySelectorAll<HTMLElement>(".dashboard-grid > *, .dashboard-window, h1")];
    const boxes = nodes.map(node => node.getBoundingClientRect());
    const overlaps = boxes.some((a,index) => boxes.slice(index+1).some(b => Math.min(a.right,b.right)-Math.max(a.left,b.left)>1 && Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1));
    const clipped = nodes.some(node => node.scrollWidth > node.clientWidth + 1);
    const unnamed = [...root.querySelectorAll<HTMLElement>("button,a")].some(node => !node.textContent?.trim());
    return {overlaps,clipped,unnamed};
  });
  expect(result).toEqual({overlaps:false,clipped:false,unnamed:false});
}
for (const role of ["requester", "staff"] as const) {
  test(`VISUAL-01 dashboard: ${role} cards and lists wrap within the viewport`, async ({ page }) => {
    await resetAccount(role);
    await login(page, USERS[role].email);
    await expect(page.getByRole("heading", { name: role === "requester" ? "Requester Dashboard" : "Staff Dashboard", exact: true })).toBeVisible();
    const card = page.getByRole("button", { name: role === "requester" ? /Open Tickets/ : /Unassigned/ });
    await expectControlInViewport(page, card);
    for (const item of await page.locator(".dashboard-grid button").all()) {
      await item.scrollIntoViewIfNeeded();
      const bounds = await item.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(-1);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expectDashboardGeometry(page);
    await page.screenshot({ path: screenshot(`${role}-dashboard`, "dashboard"), fullPage: true });
  });
}

for (const role of ["requester", "staff"] as const) {
  test(`VISUAL-01 dashboard: ${role} loading, empty, failure and long text states`, async ({ page }) => {
    test.setTimeout(90_000);
    await resetAccount(role);
    let state: "normal" | "loading" | "empty" | "failure" | "long" = "normal";
    const releaseLoading: Array<() => void> = [];
    // These response variants prove presentation only; real metrics are verified by API/E2E-02.
    await page.route(`**/api/${role}/dashboard`, async route => {
      const response = await route.fetch();
      const body = await response.json();
      if (state === "failure") {
        await route.fulfill({ status: 500, json: { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } } });
        return;
      }
      if (state === "loading") await new Promise<void>(resolve => { releaseLoading.push(resolve); });
      if (state === "empty") {
        for (const key of Object.keys(body.data.counts)) {
          const value = body.data.counts[key];
          body.data.counts[key] = typeof value === "number" ? 0 : Object.fromEntries(Object.keys(value).map(key => [key, 0]));
        }
        for (const key of Object.keys(body.data.lists)) body.data.lists[key] = [];
      }
      if (state === "long") {
        const key = role === "requester" ? "attentionTickets" : "urgentTickets";
        body.data.lists[key] = [{ ticketNumber: "TKT-2054-999999", summary: "VeryLongDashboardSummaryWithoutSpaces".repeat(15), currentStatus: "WAITING_FOR_REQUESTER", updatedAt: body.data.generatedAt, ...(role === "requester" ? { appearsResolved: false } : { itPriority: "HIGH" }) }];
      }
      await route.fulfill({ response, json: body });
    });
    await login(page, USERS[role].email);
    const title = role === "requester" ? "Requester Dashboard" : "Staff Dashboard";
    await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
    for (const next of ["loading", "empty", "failure", "long"] as const) {
      await navigate(page, role === "requester" ? "My Tickets" : "Ticket Queue");
      state = next;
      await navigate(page, "Dashboard");
      if (next === "loading") await expect(page.getByRole("status")).toHaveText("Loading dashboard…");
      if (next === "failure") await expect(page.getByRole("button", { name: "Retry", exact: true })).toBeVisible();
      if (next === "empty") {
        await expect(page.getByRole("button", { name: role === "requester" ? "Open Tickets: 0" : "Unassigned: 0", exact: true })).toBeVisible();
        const metrics = page.locator(".dashboard-metric");
        await expect(metrics).toHaveCount(role === "requester" ? 4 : 17);
        for (const metric of await metrics.all()) {
          await expect(metric.locator("strong")).toHaveText("0");
          await expect(metric.getByText(await metric.evaluate(element => element.tagName === "BUTTON") ? "No matching Tickets" : "No matching Actions", { exact: true })).toBeVisible();
        }
      }
      if (next === "long") await expect(page.getByRole("link", { name: /VeryLongDashboardSummaryWithoutSpaces/ })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await expectDashboardGeometry(page);
      await page.screenshot({ path: screenshot(`${role}-dashboard`, next), fullPage: true });
      if (next === "loading") { await expect.poll(() => releaseLoading.length > 0).toBe(true); releaseLoading.splice(0).forEach(resolve => resolve()); await expect(page.getByRole("status")).toHaveCount(0); }
    }
  });
}
