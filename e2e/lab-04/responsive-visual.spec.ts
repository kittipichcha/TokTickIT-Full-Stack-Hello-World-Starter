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
    await expect(createForm.locator(".success-box")).toContainText("Action recorded by");
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
    await expect(createForm.locator(".success-box")).toContainText("Action recorded by");
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
