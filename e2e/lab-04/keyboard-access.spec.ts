import { test, expect, type Locator, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { USERS, createRequesterTicket, login, navigate, resetAccount } from "../lab-03/helpers";

/**
 * A11Y-01 — Actions portion (Issue #52).
 *
 * Keyboard reaches the Actions cards, the Add/Edit forms, the status controls
 * and the form fields; focus is visibly outlined; labels are associated and
 * validation errors are announced through `role="alert"` + `aria-describedby`.
 */

/** Local copy of the Lab 3 helper (defined at the bottom of that file, not exported). */
async function tabTo(page: Page, target: Locator): Promise<void> {
  for (let index = 0; index < 100; index += 1) {
    if (await target.evaluate((element) => element === document.activeElement)) {
      await expectKeyboardFocus(target);
      return;
    }
    await page.keyboard.press("Tab");
  }
  throw new Error("Target control was not reachable within 100 Tab presses.");
}

async function navigateByKeyboard(page: Page, label: string, destination: Locator): Promise<void> {
  const hamburger = page.locator(".hamburger");
  if (await hamburger.isVisible()) {
    await tabTo(page, hamburger);
    await page.keyboard.press("Enter");
  }
  const link = page.locator("#primary-navigation").getByRole("link", { name: label, exact: true });
  await tabTo(page, link);
  await page.keyboard.press("Enter");
  await expect(destination).toBeVisible();
}

async function expectKeyboardFocus(target: Locator): Promise<void> {
  await expect(target).toBeFocused();
  await expect(target).toHaveCSS("outline-style", "solid");
  await expect(target).toHaveCSS("outline-width", "2px");
}

/** Shared setup: a fresh Ticket opened on the Staff detail surface. */
async function openStaffDetail(page: Page, summary: string): Promise<string> {
  await login(page, USERS.requester.email);
  const ticketNumber = await createRequesterTicket(page, summary);
  await page.getByRole("button", { name: "Logout" }).click();

  await login(page, USERS.staff.email);
  await navigateByKeyboard(
    page,
    "Ticket Queue",
    page.getByRole("searchbox", { name: "Search tickets" }),
  );
  await tabTo(page, page.getByLabel("Search tickets"));
  await page.getByLabel("Search tickets").fill(summary);
  const openDetail = page.getByRole("button", { name: "Open Detail" });
  await tabTo(page, openDetail);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: ticketNumber })).toBeVisible();
  return ticketNumber;
}

test.describe("A11Y-01 (Actions portion): Actions Taken keyboard and focus behavior", () => {
  test.beforeEach(async () => {
    await resetAccount("requester");
    await resetAccount("staff");
    await resetAccount("adminPeer");
  });

  test("Add Action form fields are label-associated and reachable with visible focus", async ({ page }) => {
    const summary = `Issue 52 keyboard form ${Date.now()}`;
    await openStaffDetail(page, summary);

    const actionsSection = page.locator('section[aria-label="Actions Taken"]');
    const addButton = actionsSection.getByRole("button", { name: "Add Action" });
    await tabTo(page, addButton);
    await page.keyboard.press("Enter");

    const createForm = page.locator('form[aria-label="Add Action"]');
    await expect(createForm).toBeVisible();

    // Labels resolve to their controls (association is what getByLabel proves).
    await expect(page.getByLabel("Description")).toBeVisible();
    await expect(page.getByLabel("Result")).toBeVisible();
    await expect(page.getByLabel("Follow-up Required")).toBeVisible();
    await expect(page.getByLabel("Attachment Notes")).toBeVisible();
    await expect(page.getByLabel("Assignee")).toBeEnabled();

    // Every field is Tab-reachable with the focus-visible outline.
    await tabTo(page, createForm.locator("#action-description"));
    await tabTo(page, createForm.locator("#action-result"));
    await tabTo(page, createForm.locator("#action-followup"));
    await tabTo(page, createForm.locator("#action-attachment-notes"));
    await tabTo(page, createForm.locator("#action-assignee"));

    const submit = createForm.getByRole("button", { name: "Record Action" });
    await tabTo(page, submit);
    const cancel = createForm.getByRole("button", { name: "Cancel" });
    await tabTo(page, cancel);
    await page.keyboard.press("Enter");
    await expect(createForm).toHaveCount(0);
  });

  test("empty Description submit announces an error linked by aria-describedby", async ({ page }) => {
    const summary = `Issue 52 keyboard error ${Date.now()}`;
    await openStaffDetail(page, summary);

    const actionsSection = page.locator('section[aria-label="Actions Taken"]');
    await tabTo(page, actionsSection.getByRole("button", { name: "Add Action" }));
    await page.keyboard.press("Enter");

    const createForm = page.locator('form[aria-label="Add Action"]');
    await expect(createForm).toBeVisible();
    const submit = createForm.getByRole("button", { name: "Record Action" });
    await tabTo(page, submit);
    await page.keyboard.press("Enter");

    const error = createForm.locator("#action-description-error");
    await expect(error).toBeVisible();
    await expect(error).toHaveAttribute("role", "alert");
    await expect(error).toHaveText("Description is required.");

    const description = createForm.locator("#action-description");
    await expect(description).toHaveAttribute("aria-invalid", "true");
    const describedBy = await description.getAttribute("aria-describedby");
    expect(describedBy).toContain("action-description-error");

    // Focus never left the submit control, and its outline stays visible.
    await expectKeyboardFocus(submit);
  });

  test("Follow-up flag reveals a reachable note and status radios sit in a labelled radiogroup", async ({ page }) => {
    const summary = `Issue 52 keyboard status ${Date.now()}`;
    await openStaffDetail(page, summary);

    const actionsSection = page.locator('section[aria-label="Actions Taken"]');

    // Create one Pending Action so there is a card to Edit.
    await tabTo(page, actionsSection.getByRole("button", { name: "Add Action" }));
    await page.keyboard.press("Enter");
    const createForm = page.locator('form[aria-label="Add Action"]');
    await expect(createForm).toBeVisible();
    await tabTo(page, createForm.locator("#action-description"));
    await createForm.locator("#action-description").fill("Keyboard status smoke Action.");
    await tabTo(page, createForm.getByRole("button", { name: "Record Action" }));
    await page.keyboard.press("Enter");
    await expect(actionsSection.locator(".success-box")).toContainText(
      "Action recorded successfully",
    );
    await tabTo(page, createForm.getByRole("button", { name: "Cancel" }));
    await page.keyboard.press("Enter");
    await expect(createForm).toHaveCount(0);

    const card = actionsSection
      .locator("li.action-card")
      .filter({ hasText: "Keyboard status smoke Action." });
    await expect(card).toBeVisible();
    // Status is conveyed as text, never colour alone.
    await expect(card.locator(".action-status-badge")).toHaveText("Pending");

    await tabTo(page, card.getByRole("button", { name: "Edit Action" }));
    await page.keyboard.press("Enter");
    const editForm = page.locator('form[aria-label="Edit Action"]');
    await expect(editForm).toBeVisible();

    // Checking Follow-up Required reveals the conditional note, Tab-reachable.
    await tabTo(page, editForm.locator("#action-followup"));
    await page.keyboard.press("Space");
    const followUpNote = editForm.locator("#action-followup-note");
    await expect(followUpNote).toBeVisible();
    await expect(followUpNote).toHaveAttribute("aria-required", "true");
    await tabTo(page, followUpNote);

    // Status controls live in a labelled radiogroup and are reachable.
    const radiogroup = editForm.locator('[role="radiogroup"][aria-label="Action status"]');
    await expect(radiogroup).toBeVisible();
    // Tab enters the group and lands on the checked radio; arrow keys then move
    // between options (the next Tab would exit the group entirely).
    await tabTo(page, editForm.locator("#action-status-pending"));
    await expectKeyboardFocus(editForm.locator("#action-status-pending"));
    await page.keyboard.press("ArrowDown");
    await expectKeyboardFocus(editForm.locator("#action-status-completed"));
    await page.keyboard.press("ArrowDown");
    await expectKeyboardFocus(editForm.locator("#action-status-cancelled"));

    await tabTo(page, editForm.getByRole("button", { name: "Cancel" }));
    await page.keyboard.press("Enter");
    await expect(editForm).toHaveCount(0);
  });
});

test("A11Y-01 dashboard: keyboard reaches metric cards and preserves active mobile navigation", async ({ page }) => {
  await resetAccount("requester");
  await login(page, USERS.requester.email);
  await expect(page.getByRole("heading", { name: "Requester Dashboard", exact: true })).toBeVisible();
  const card = page.getByRole("button", { name: /Open Tickets/ });
  await tabTo(page, card);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("searchbox", { name: "Search tickets" })).toBeVisible();
  await expect(page.locator("#primary-navigation").getByRole("link", { name: "My Tickets", exact: true, includeHidden: true })).toHaveAttribute("aria-current", "page");
  await navigateByKeyboard(page, "Dashboard", page.getByRole("heading", { name: "Requester Dashboard", exact: true }));
  await expect(page.locator("#primary-navigation").getByRole("link", { name: "Dashboard", exact: true, includeHidden: true })).toHaveAttribute("aria-current", "page");
  const hamburger = page.locator(".hamburger");
  if (await hamburger.isVisible()) await expect(hamburger).toHaveAttribute("aria-expanded", "false");
});

test("A11Y-01 dashboard: keyboard Retry performs one read and restores cards", async ({ page }) => {
  await resetAccount("requester");
  let attempts = 0;
  let failReads = true;
  await page.route("**/api/requester/dashboard", async route => {
    attempts++;
    if (failReads) await route.fulfill({ status: 500, json: { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } } });
    else await route.continue();
  });
  await login(page, USERS.requester.email);
  const retry = page.getByRole("button", { name: "Retry", exact: true });
  await expect(retry).toBeVisible();
  await tabTo(page, retry);
  const initialAttempts = attempts;
  failReads = false;
  await page.keyboard.press("Enter");
  const card = page.getByRole("button", { name: "Open Tickets: 0", exact: true });
  await expect(card).toBeVisible();
  expect(attempts).toBe(initialAttempts + 1);
  await tabTo(page, card);
});

for (const role of ["staff", "admin"] as const) {
  test(`A11Y-01 ${role}: Ticket metrics use keyboard and Action totals stay outside the Tab order`, async ({ page }) => {
    await resetAccount(role);
    await login(page, USERS[role].email);
    const card = page.getByRole("button", { name: /Unassigned:/ });
    await tabTo(page, card);
    expect(await page.locator(".dashboard-metric").evaluateAll(nodes => nodes.filter(node => node.tagName === "DIV").every(node => (node as HTMLElement).tabIndex < 0))).toBe(true);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("searchbox", { name: "Search tickets" })).toBeVisible();
    await navigateByKeyboard(page, "Dashboard", page.getByRole("heading", { name: "Staff Dashboard", exact: true }));
  });
}

test("A11Y-01 workflow: Resolved, Closed and Cancelled confirmations trap focus and safely dismiss", async ({ page }) => {
  test.setTimeout(90_000);
  await resetAccount("requester");
  await resetAccount("staff");
  await openStaffDetail(page, `Issue 55 keyboard confirmations ${Date.now()}`);
  const claim = page.getByRole("button", { name: "Claim / Reassign to me", exact: true });
  await tabTo(page, claim);
  await page.keyboard.press("Enter");
  const controls = page.locator("section").filter({ has: page.getByRole("heading", { name: "Ticket controls" }) });
  for (const status of ["Open", "In Progress"]) {
    const button = controls.getByRole("button", { name: status, exact: true });
    await expect(button).toBeEnabled();
    await tabTo(page, button);
    await page.keyboard.press("Enter");
    await expect(page.locator(".status-badge").first()).toHaveText(status.toUpperCase().replaceAll(" ", "_"));
  }
  const writes: string[] = [];
  page.on("request", request => { if (request.method() === "PATCH" && /\/status$/.test(request.url())) writes.push(request.url()); });
  for (const [status, consequence] of [["Resolved", "prevents new Actions until the Ticket is reopened"], ["Closed", "closes the Ticket and prevents new Actions"], ["Cancelled", "No further status changes or new Actions will be allowed"]]) {
    const invoke = controls.getByRole("button", { name: status, exact: true });
    const before = writes.length;
    for (const dismiss of ["Escape", "Cancel"]) {
      await tabTo(page, invoke);
      await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog", { name: "Confirm status change" });
      await expect(dialog).toContainText(status);
      await expect(dialog).toContainText(consequence);
      if (dismiss === "Escape") {
        const bounds = await dialog.boundingBox();
        expect(bounds!.x).toBeGreaterThanOrEqual(0);
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
        expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
        const directory = path.resolve("artifacts/lab-04/screenshots/ticket-workflow");
        mkdirSync(directory, { recursive: true });
        await page.screenshot({ path: path.join(directory, `${test.info().project.name}-confirm-${status.toLowerCase()}.png`), fullPage: false });
      }
      const cancel = dialog.getByRole("button", { name: "Cancel", exact: true });
      const confirm = dialog.getByRole("button", { name: "Confirm", exact: true });
      await expect(cancel).toBeFocused();
      await page.keyboard.press("Shift+Tab");
      await expect(confirm).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(cancel).toBeFocused();
      if (dismiss === "Escape") await page.keyboard.press("Escape");
      else await page.keyboard.press("Enter");
      await expect(dialog).toHaveCount(0);
      await expect(invoke).toBeFocused();
      expect(writes).toHaveLength(before);
    }
    // Closed becomes available only after a successful Resolved transition.
    if (status !== "Cancelled") {
      await tabTo(page, invoke);
      await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog", { name: "Confirm status change" });
      await tabTo(page, dialog.getByRole("button", { name: "Confirm", exact: true }));
      await page.keyboard.press("Enter");
      await expect(dialog).toHaveCount(0);
      await expect(page.locator(".status-badge").first()).toHaveText(status.toUpperCase());
      await expect(page.getByRole("link", { name: "← Back to Queue", exact: true })).toBeFocused();
    }
  }
});
