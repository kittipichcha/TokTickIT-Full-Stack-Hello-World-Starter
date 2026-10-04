import { test, expect } from "@playwright/test";
import { PASSWORD, USERS, createRequesterTicket, login, navigate, resetAccount } from "../lab-03/helpers";

/**
 * E2E-01 — Actions portion (Issue #52).
 *
 * Covers the Actions Taken half of the E2E-01 row: Staff creates two Pending
 * Actions on one Ticket, completes A with a Result, cancels B without a
 * Result, and the owning Requester then sees performer/assignee names on
 * read-only Actions. It also covers the inactive-assignee HTTP 409 recovery
 * path (assignee eligibility is Action behavior owned by Issue #52).
 *
 * Deliberately NOT covered here (owned by `ticket-resolution.spec.ts`, #53):
 *   - resolution being blocked while Pending Actions remain,
 *   - resolving the Ticket after the Pending Actions are cleared.
 */
test.describe("E2E-01 (Actions portion): Actions Taken flow", () => {
  test.beforeEach(async () => {
    await resetAccount("requester");
    await resetAccount("staff");
    await resetAccount("admin");
    await resetAccount("adminPeer");
  });

  test("Staff completes A with a Result, cancels B without one, and Requester sees read-only names", async ({ page }) => {
    const summary = `Issue 52 actions flow ${Date.now()}`;

    await login(page, USERS.requester.email);
    const ticketNumber = await createRequesterTicket(page, summary);
    await page.getByRole("button", { name: "Logout" }).click();
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

    await login(page, USERS.staff.email);
    await navigate(page, "Ticket Queue");
    await page.getByLabel("Search tickets").fill(summary);
    await page.getByRole("button", { name: "Open Detail" }).click();
    await expect(page.getByRole("heading", { name: ticketNumber })).toBeVisible();

    const actionsSection = page.locator('section[aria-label="Actions Taken"]');
    await expect(actionsSection).toBeVisible();
    await expect(actionsSection.getByRole("heading", { name: "Actions Taken" })).toBeVisible();
    await expect(actionsSection.getByText("No Actions recorded for this Ticket.")).toBeVisible();

    // --- Ticket Owner is a THIRD identity, distinct from performer/assignee ---
    await page.getByLabel("Ticket Owner").selectOption({
      label: `${USERS.admin.name} — Administrator`,
    });
    const ownerOptionValue = await page
      .locator("#owner-select option:checked")
      .getAttribute("value");
    expect(ownerOptionValue).toBeTruthy();
    await page.getByRole("button", { name: "Assign", exact: true }).click();
    await expect(page.locator(".ticket-info-row").filter({ hasText: "Owner" })).toContainText(
      `User #${ownerOptionValue}`,
    );
    await expect(page.locator(".ticket-info-row").filter({ hasText: "Owner" })).not.toContainText(
      "Unassigned",
    );

    // --- Action A: Pending, assigned to a different eligible user ---
    await actionsSection.getByRole("button", { name: "Add Action" }).click();
    const createForm = page.locator('form[aria-label="Add Action"]');
    await expect(createForm).toBeVisible();
    await createForm.locator("#action-description").fill("Action A — clear the print queue");
    await expect(createForm.locator("#action-assignee")).toBeEnabled();
    await createForm.locator("#action-assignee").selectOption({
      label: `${USERS.adminPeer.name} — Administrator`,
    });
    await createForm.getByRole("button", { name: "Record Action" }).click();
    await expect(actionsSection.locator(".success-box")).toContainText(
      "Action recorded successfully",
    );
    await createForm.getByRole("button", { name: "Cancel" }).click();
    await expect(createForm).toHaveCount(0);

    const cardA = actionsSection
      .locator("li.action-card")
      .filter({ hasText: "Action A — clear the print queue" });
    await expect(cardA).toBeVisible();
    await expect(cardA.locator(".action-status-badge")).toHaveText("Pending");
    await expect(cardA.locator(".action-field").filter({ hasText: "Performed by" }).first()).toContainText(
      USERS.staff.name,
    );

    // --- Action B: Pending, unassigned ---
    await actionsSection.getByRole("button", { name: "Add Action" }).click();
    await expect(createForm).toBeVisible();
    await createForm.locator("#action-description").fill("Action B — reseat the network cable");
    await createForm.getByRole("button", { name: "Record Action" }).click();
    await expect(actionsSection.locator(".success-box")).toContainText(
      "Action recorded successfully",
    );
    await createForm.getByRole("button", { name: "Cancel" }).click();
    await expect(createForm).toHaveCount(0);

    const cardB = actionsSection
      .locator("li.action-card")
      .filter({ hasText: "Action B — reseat the network cable" });
    await expect(cardB).toBeVisible();
    await expect(cardB.locator(".action-status-badge")).toHaveText("Pending");
    await expect(actionsSection.locator("li.action-card")).toHaveCount(2);

    // --- Complete A with a Result ---
    await cardA.getByRole("button", { name: "Edit Action" }).click();
    const editForm = page.locator('form[aria-label="Edit Action"]');
    await expect(editForm).toBeVisible();
    await editForm.locator("#action-result").fill("Queue cleared; test page printed.");
    await editForm.locator("#action-status-completed").check();
    await editForm.getByRole("button", { name: "Save Action" }).click();
    await expect(editForm).toHaveCount(0);
    // B1 — the success announcement survives the edit form closing.
    await expect(actionsSection.locator(".success-box")).toContainText(
      "Action updated successfully",
    );
    await expect(cardA.locator(".action-status-badge")).toHaveText("Completed");
    await expect(cardA.locator(".action-field").filter({ hasText: "Result" }).first()).toContainText(
      "Queue cleared; test page printed.",
    );
    await expect(cardA.getByRole("button", { name: "View Action" })).toBeVisible();

    // --- Cancel B without a Result ---
    await cardB.getByRole("button", { name: "Edit Action" }).click();
    await expect(editForm).toBeVisible();
    await editForm.locator("#action-status-cancelled").check();
    await editForm.getByRole("button", { name: "Save Action" }).click();
    await expect(editForm).toHaveCount(0);
    await expect(cardB.locator(".action-status-badge")).toHaveText("Cancelled");
    await expect(cardB.locator(".action-field").filter({ hasText: "Result" }).first()).toContainText("—");
    await expect(cardB.getByRole("button", { name: "View Action" })).toBeVisible();

    // Terminal Actions are no longer editable.
    await expect(cardA.getByRole("button", { name: "Edit Action" })).toHaveCount(0);
    await expect(cardB.getByRole("button", { name: "Edit Action" })).toHaveCount(0);

    // --- Requester read-only projection ---
    await page.getByRole("button", { name: "Logout" }).click();
    await login(page, USERS.requester.email);
    await navigate(page, "My Tickets");
    await page.getByRole("link", { name: ticketNumber }).click();

    const requesterSection = page.locator('section[aria-label="Actions Taken"]');
    await expect(requesterSection).toBeVisible();
    await expect(requesterSection.getByRole("heading", { name: "Actions Taken" })).toBeVisible();

    const requesterCardA = requesterSection
      .locator("li.action-card")
      .filter({ hasText: "Action A — clear the print queue" });
    const requesterCardB = requesterSection
      .locator("li.action-card")
      .filter({ hasText: "Action B — reseat the network cable" });
    await expect(requesterCardA).toBeVisible();
    await expect(requesterCardB).toBeVisible();
    await expect(requesterCardA.locator(".action-status-badge")).toHaveText("Completed");
    await expect(requesterCardB.locator(".action-status-badge")).toHaveText("Cancelled");

    // Performer and assignee display names are both visible and distinct.
    const performer = requesterCardA
      .locator(".action-field")
      .filter({ hasText: "Performed by" })
      .first();
    const assignee = requesterCardA.locator(".action-field").filter({ hasText: "Assignee" }).first();
    await expect(performer).toContainText(USERS.staff.name);
    await expect(assignee).toContainText(USERS.adminPeer.name);

    // B3 — Ticket Owner, performer, and assignee are three DIFFERENT identities.
    expect(USERS.staff.name).not.toBe(USERS.adminPeer.name);
    expect(USERS.admin.name).not.toBe(USERS.staff.name);
    expect(USERS.admin.name).not.toBe(USERS.adminPeer.name);

    // No write controls of any kind reach the Requester surface.
    await expect(page.getByRole("button", { name: "Add Action" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Edit Action" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "View Action" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Record Action" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Save Action" })).toHaveCount(0);
    await expect(page.locator('form[aria-label="Add Action"]')).toHaveCount(0);
    await expect(page.locator('form[aria-label="Edit Action"]')).toHaveCount(0);
    await expect(page.locator("#action-description")).toHaveCount(0);
    await expect(page.locator("#action-status-completed")).toHaveCount(0);
  });

  test("an assignee deactivated mid-session is rejected by the server with safe 409 feedback and explicit repair", async ({ page }) => {
    const summary = `Issue 52 assignee 409 ${Date.now()}`;
    try {
      // --- Arrange: a Ticket with one Pending Action assigned to adminPeer ---
      await login(page, USERS.requester.email);
      const ticketNumber = await createRequesterTicket(page, summary);
      await page.getByRole("button", { name: "Logout" }).click();

      await login(page, USERS.staff.email);
      await navigate(page, "Ticket Queue");
      await page.getByLabel("Search tickets").fill(summary);
      await page.getByRole("button", { name: "Open Detail" }).click();
      await expect(page.getByRole("heading", { name: ticketNumber })).toBeVisible();

      const actionsSection = page.locator('section[aria-label="Actions Taken"]');
      await actionsSection.getByRole("button", { name: "Add Action" }).click();
      const createForm = page.locator('form[aria-label="Add Action"]');
      await createForm.locator("#action-description").fill("Action C — rotate the service account");
      await expect(createForm.locator("#action-assignee")).toBeEnabled();
      await createForm.locator("#action-assignee").selectOption({
        label: `${USERS.adminPeer.name} — Administrator`,
      });
      await createForm.getByRole("button", { name: "Record Action" }).click();
      await expect(actionsSection.locator(".success-box")).toContainText(
        "Action recorded successfully",
      );
      await createForm.getByRole("button", { name: "Cancel" }).click();

      const cardC = actionsSection
        .locator("li.action-card")
        .filter({ hasText: "Action C — rotate the service account" });
      await expect(cardC).toBeVisible();
      await expect(cardC.locator(".action-status-badge")).toHaveText("Pending");

      // --- The edit form learns the eligible owner state while adminPeer is active ---
      await cardC.getByRole("button", { name: "Edit Action" }).click();
      const editForm = page.locator('form[aria-label="Edit Action"]');
      await expect(editForm).toBeVisible();
      await expect(editForm.locator("#action-assignee")).toBeEnabled();
      await expect(
        editForm.locator("#action-assignee option", { hasText: `${USERS.adminPeer.name} — Administrator` }),
      ).toHaveCount(1);

      // Deactivate adminPeer AFTER the form has learned the eligible state.
      await resetAccount("adminPeer", false, PASSWORD, false);

      // --- Act: submit; the real server rejects the now-ineligible assignee (HTTP 409) ---
      const draftDescription = "Action C — rotate the service account (edited draft)";
      await editForm.locator("#action-description").fill(draftDescription);
      await editForm.getByRole("button", { name: "Save Action" }).click();

      // --- Assert: safe 409 feedback, draft retained, no persisted mutation ---
      await expect(editForm.locator(".error-box")).toContainText(
        "not an active IT Staff or Administrator",
      );
      await expect(editForm.locator("#action-description")).toHaveValue(draftDescription);

      // The persisted Action is unchanged: original description, still Pending.
      await expect(cardC.locator(".action-card-description")).toHaveText(
        "Action C — rotate the service account",
      );
      await expect(cardC.locator(".action-status-badge")).toHaveText("Pending");

      // --- Recovery: Review latest refreshes owners; ineligible stays visible ---
      await editForm.getByRole("button", { name: "Review latest Action" }).click();
      await expect(
        editForm.locator("#action-assignee-ineligible"),
      ).toContainText("no longer an active Staff/Administrator");
      await expect(
        editForm.locator("#action-assignee option:checked"),
      ).toContainText("(ineligible)");

      // Resubmission stays blocked until the assignee is explicitly repaired.
      await editForm.getByRole("button", { name: "Save Action" }).click();
      await expect(editForm.locator(".field-error")).toContainText(
        "no longer eligible. Choose an eligible assignee or unassign.",
      );

      // Explicit repair (unassign) unblocks the save and commits the draft.
      await editForm.locator("#action-assignee").selectOption("");
      await editForm.getByRole("button", { name: "Save Action" }).click();
      await expect(editForm).toHaveCount(0);
      await expect(cardC.locator(".action-card-description")).toHaveText(draftDescription);
      await expect(
        cardC.locator(".action-field").filter({ hasText: "Assignee" }).first(),
      ).toContainText("Unassigned");
      await expect(cardC.locator(".action-status-badge")).toHaveText("Pending");
    } finally {
      // Restore adminPeer so later tests/projects stay deterministic.
      await resetAccount("adminPeer");
    }
  });

  test("terminal Ticket shows reopen guidance and hides Add Action", async ({ page }) => {
    // Seeded E2E fixture: a RESOLVED Ticket reachable through the Staff Queue.
    await login(page, USERS.staff.email);
    await navigate(page, "Ticket Queue");
    await page.getByLabel("Search tickets").fill("Printer not detected on network");
    await page.getByRole("button", { name: "Open Detail" }).click();
    await expect(page.getByRole("heading", { name: "TKT-2026-000005" })).toBeVisible();

    const actionsSection = page.locator('section[aria-label="Actions Taken"]');
    await expect(actionsSection).toBeVisible();
    await expect(actionsSection.getByRole("heading", { name: "Actions Taken" })).toBeVisible();
    await expect(actionsSection.getByRole("note")).toContainText(
      "Reopen it before recording new Actions.",
    );
    await expect(actionsSection.getByRole("button", { name: "Add Action" })).toHaveCount(0);
    await expect(page.locator('form[aria-label="Add Action"]')).toHaveCount(0);
  });
});
