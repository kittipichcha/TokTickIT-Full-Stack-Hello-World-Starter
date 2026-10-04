/**
 * Frozen Test-DD file: `client/src/lab-04-tests/ActionsTaken.test.tsx`
 *
 * Owned by Issue #52. Frozen row executed here:
 *   - UI-ACT-01 — Staff/Admin list/create/view/edit and Requester read-only
 *     Actions Taken area (AC-03–07, AC-21; FR-01/03/04/06/18).
 *
 * Authoritative row: `docs/lab-04/tests.md` (search `UI-ACT-01`).
 * Frozen UI contract: `docs/lab-04/ui-spec.md` §3 (plus §1, §6).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RequesterActionsTaken, StaffActionsTaken } from "../ActionsTaken";
import ActionForm from "../ActionForm";
import * as api from "../api";

vi.mock("../api");

const TICKET = "TKT-2026-000001";

const OWNERS: api.AssignableOwner[] = [
  { id: 5, name: "Alice", role: "IT_STAFF" },
  { id: 6, name: "Bob", role: "IT_STAFF" },
  { id: 9, name: "Carol", role: "ADMINISTRATOR" },
];

const EMPTY_PAGINATION = { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 } as const;

function apiError(status: number, message: string): api.ApiError {
  const e = new Error(message) as api.ApiError;
  e.status = status;
  return e;
}

function staffAction(overrides: Partial<api.StaffActionDto> = {}): api.StaffActionDto {
  return {
    id: 1,
    ticketNumber: TICKET,
    description: "Checked the print queue",
    result: null,
    followUpRequired: false,
    followUpNote: null,
    attachmentNotes: null,
    status: "PENDING",
    performedBy: { id: 5, name: "Alice" },
    assignee: { id: 6, name: "Bob", role: "IT_STAFF" },
    createdAt: "2026-09-10T00:00:00Z",
    updatedAt: "2026-09-11T00:00:00Z",
    version: 1,
    ...overrides,
  };
}

function requesterAction(overrides: Partial<api.RequesterActionDto> = {}): api.RequesterActionDto {
  return {
    id: 1,
    ticketNumber: TICKET,
    description: "Checked the print queue",
    result: null,
    followUpRequired: false,
    followUpNote: null,
    attachmentNotes: null,
    status: "PENDING",
    performedBy: { name: "Alice" },
    assignee: { name: "Bob" },
    createdAt: "2026-09-10T00:00:00Z",
    updatedAt: "2026-09-11T00:00:00Z",
    ...overrides,
  };
}

function pageOf<T>(items: T[], page: number, pageSize = 10): api.ActionListResponse<T> {
  const start = (page - 1) * pageSize;
  return {
    data: items.slice(start, start + pageSize),
    pagination: {
      page,
      pageSize,
      totalItems: items.length,
      totalPages: Math.ceil(items.length / pageSize),
    },
  };
}

const STAFF_21: api.StaffActionDto[] = Array.from({ length: 21 }, (_, i) =>
  staffAction({ id: i + 1, description: `Action item ${i + 1}` }),
);
const STAFF_15: api.StaffActionDto[] = STAFF_21.slice(0, 15);
const REQUESTER_21: api.RequesterActionDto[] = Array.from({ length: 21 }, (_, i) =>
  requesterAction({ id: i + 1, description: `Action item ${i + 1}` }),
);

/**
 * Sets a textarea's value in one shot (bypassing per-keystroke renders) for
 * bound-length checks; React still receives a normal `input` event.
 */
function setTextValue(el: HTMLTextAreaElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.fetchStaffActions).mockResolvedValue({ data: [], pagination: EMPTY_PAGINATION });
  vi.mocked(api.fetchRequesterActions).mockResolvedValue({ data: [], pagination: EMPTY_PAGINATION });
  vi.mocked(api.fetchAssignableOwners).mockResolvedValue(OWNERS);
  vi.mocked(api.createTicketAction).mockResolvedValue(staffAction({ id: 100, description: "Created" }));
  vi.mocked(api.updateTicketAction).mockResolvedValue(staffAction({ id: 1, version: 2 }));
  vi.mocked(api.fetchActionDetail).mockResolvedValue(staffAction({ id: 42 }));
});
afterEach(() => cleanup());

// ---------------------------------------------------------------------------
// Staff/Admin list read states (AC-04, AC-21; FR-18)
// ---------------------------------------------------------------------------

describe("UI-ACT-01 — Staff/Admin list read states (AC-04, AC-21, FR-18)", () => {
  it("FR-18 — shows the labeled loading state until the list resolves", () => {
    vi.mocked(api.fetchStaffActions).mockImplementation(
      () => new Promise<api.ActionListResponse<api.StaffActionDto>>(() => {}),
    );
    render(<StaffActionsTaken ticketNumber={TICKET} ticketStatus="OPEN" />);

    expect(screen.getByRole("status", { name: "Loading Actions" })).toBeTruthy();
    expect(screen.queryByText(/No Actions recorded/)).toBeNull();
    expect(screen.queryByRole("navigation", { name: "Actions pages" })).toBeNull();
  });

  it("AC-04 — shows the zero-Action empty state and hides pagination", async () => {
    render(<StaffActionsTaken ticketNumber={TICKET} ticketStatus="OPEN" />);

    expect(await screen.findByText("No Actions recorded for this Ticket.")).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: "Actions pages" })).toBeNull();
    expect(api.fetchStaffActions).toHaveBeenCalledWith(TICKET, 1, 10);
  });

  it("AC-04 — renders loaded cards with textual status chips, all fields, and one control each", async () => {
    const full = staffAction({
      id: 1,
      description: "Replaced the fuser",
      result: "Print quality restored",
      followUpRequired: true,
      followUpNote: "Watch the next 50 pages",
      attachmentNotes: "Serial photo attached",
      status: "PENDING",
    });
    const sparse = staffAction({
      id: 2,
      description: "Awaited user confirmation",
      result: null,
      followUpRequired: false,
      followUpNote: null,
      attachmentNotes: null,
      assignee: null,
    });
    vi.mocked(api.fetchStaffActions).mockResolvedValue({
      data: [full, sparse],
      pagination: { page: 1, pageSize: 10, totalItems: 2, totalPages: 1 },
    });
    const { container } = render(<StaffActionsTaken ticketNumber={TICKET} ticketStatus="OPEN" />);

    expect(await screen.findByText("Replaced the fuser")).toBeTruthy();
    expect(container.querySelector('section.actions-taken[aria-label="Actions Taken"]')).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Actions Taken" })).toBeTruthy();

    const cardA = screen.getByText("Replaced the fuser").closest("li") as HTMLElement;
    const wa = within(cardA);
    const chip = wa.getByText("Pending");
    expect(chip.classList.contains("action-status-badge")).toBe(true); // text, not colour alone
    expect(wa.getByText("Result")).toBeTruthy();
    expect(wa.getByText("Print quality restored")).toBeTruthy();
    expect(wa.getByText("Follow-up Required")).toBeTruthy();
    expect(wa.getByText("Yes")).toBeTruthy();
    expect(wa.getByText("Follow-up Note")).toBeTruthy();
    expect(wa.getByText("Watch the next 50 pages")).toBeTruthy();
    expect(wa.getByText("Attachment Notes")).toBeTruthy();
    expect(wa.getByText("Serial photo attached")).toBeTruthy();
    expect(wa.getByText("Performed by")).toBeTruthy();
    expect(wa.getByText("Alice")).toBeTruthy();
    expect(wa.getByText("Assignee")).toBeTruthy();
    expect(wa.getByText("Bob")).toBeTruthy();
    expect(wa.getByText("Last Updated")).toBeTruthy();
    expect(wa.getByText("2026-09-11 00:00:00 UTC")).toBeTruthy();
    expect(wa.getAllByRole("button")).toHaveLength(1);
    expect(wa.getByRole("button", { name: "Edit Action" })).toBeTruthy();

    const cardB = screen.getByText("Awaited user confirmation").closest("li") as HTMLElement;
    const wb = within(cardB);
    expect(wb.getByText("Pending")).toBeTruthy();
    expect(wb.getByText("No")).toBeTruthy();
    expect(wb.queryByText("Follow-up Note")).toBeNull(); // note null → field hidden
    expect(wb.getByText("Unassigned")).toBeTruthy();
    expect(wb.getAllByText("—")).toHaveLength(2); // null Result + null Attachment Notes
    expect(wb.getAllByRole("button")).toHaveLength(1);
    expect(wb.getByRole("button", { name: "Edit Action" })).toBeTruthy();
  });

  it("AC-06 — shows one View Action control for terminal cards", async () => {
    const done = staffAction({ id: 3, description: "Replaced the roller", status: "COMPLETED", result: "All good" });
    const cancelled = staffAction({ id: 4, description: "User solved it", status: "CANCELLED" });
    vi.mocked(api.fetchStaffActions).mockResolvedValue({
      data: [done, cancelled],
      pagination: { page: 1, pageSize: 10, totalItems: 2, totalPages: 1 },
    });
    render(<StaffActionsTaken ticketNumber={TICKET} ticketStatus="OPEN" />);

    const cardDone = (await screen.findByText("Replaced the roller")).closest("li") as HTMLElement;
    expect(within(cardDone).getByText("Completed")).toBeTruthy();
    expect(within(cardDone).getAllByRole("button")).toHaveLength(1);
    expect(within(cardDone).getByRole("button", { name: "View Action" })).toBeTruthy();

    const cardCancelled = screen.getByText("User solved it").closest("li") as HTMLElement;
    expect(within(cardCancelled).getByText("Cancelled")).toBeTruthy();
    expect(within(cardCancelled).getAllByRole("button")).toHaveLength(1);
    expect(within(cardCancelled).getByRole("button", { name: "View Action" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Edit Action" })).toBeNull();
  });

  it("FR-18 — 403 renders access denied with no Retry", async () => {
    vi.mocked(api.fetchStaffActions).mockRejectedValue(apiError(403, "Forbidden"));
    render(<StaffActionsTaken ticketNumber={TICKET} ticketStatus="OPEN" />);

    expect(await screen.findByText("You do not have permission to view Actions for this Ticket.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });

  it("FR-18 — 404 renders Actions not found with no Retry", async () => {
    vi.mocked(api.fetchStaffActions).mockRejectedValue(apiError(404, "Missing actions"));
    render(<StaffActionsTaken ticketNumber={TICKET} ticketStatus="OPEN" />);

    expect(await screen.findByText("Actions not found.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });

  it("FR-18 — generic read failure renders the message with a working Retry", async () => {
    vi.mocked(api.fetchStaffActions)
      .mockRejectedValueOnce(apiError(500, "Server exploded"))
      .mockResolvedValue({ data: [], pagination: EMPTY_PAGINATION });
    render(<StaffActionsTaken ticketNumber={TICKET} ticketStatus="OPEN" />);

    expect(await screen.findByText("Server exploded")).toBeTruthy();
    const alert = screen.getByRole("alert");
    expect(alert.className).toContain("error-box");
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("No Actions recorded for this Ticket.")).toBeTruthy();
    expect(api.fetchStaffActions).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// Create gate (BR-27; AC-21)
// ---------------------------------------------------------------------------

describe("UI-ACT-01 — Create gate BR-27 (AC-21)", () => {
  it.each(["RESOLVED", "CLOSED", "CANCELLED"])(
    "BR-27 — %s Ticket hides Add Action and shows reopen guidance",
    async (status) => {
      render(<StaffActionsTaken ticketNumber={TICKET} ticketStatus={status} />);
      await screen.findByText("No Actions recorded for this Ticket.");

      expect(screen.queryByRole("button", { name: "Add Action" })).toBeNull();
      const guidance = screen.getByRole("note");
      expect(guidance.className).toContain("action-reopen-guidance");
      expect(guidance.textContent).toContain("Reopen it before recording new Actions.");
    },
  );

  it("BR-27 — Add Action on an open Ticket opens the form and Cancel returns to the list", async () => {
    render(<StaffActionsTaken ticketNumber={TICKET} ticketStatus="OPEN" />);
    await screen.findByText("No Actions recorded for this Ticket.");

    await userEvent.click(screen.getByRole("button", { name: "Add Action" }));
    expect(await screen.findByRole("heading", { level: 3, name: "Add Action" })).toBeTruthy();
    expect(screen.getByLabelText(/Description/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Record Action" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("heading", { level: 3, name: "Add Action" })).toBeNull();
    expect(screen.getByRole("button", { name: "Add Action" })).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Fixed-size pagination (AC-04, AC-21; FR-01)
// ---------------------------------------------------------------------------

describe("UI-ACT-01 — Fixed-size pagination (AC-04, AC-21, FR-01)", () => {
  it("AC-04 — walks 21 ordered Actions across three fixed-size-10 pages", async () => {
    vi.mocked(api.fetchStaffActions).mockImplementation(async (_tn, page = 1) => pageOf(STAFF_21, page));
    const { container } = render(<StaffActionsTaken ticketNumber={TICKET} ticketStatus="OPEN" />);

    // Page 1.
    expect(await screen.findByText("Page 1 of 3")).toBeTruthy();
    expect(api.fetchStaffActions).toHaveBeenNthCalledWith(1, TICKET, 1, 10);
    expect(screen.getAllByRole("listitem")).toHaveLength(10);
    expect(screen.getByText("Action item 1")).toBeTruthy();
    expect(screen.getByText("Action item 10")).toBeTruthy();
    expect(screen.queryByText("Action item 11")).toBeNull();
    const nav = screen.getByRole("navigation", { name: "Actions pages" });
    expect(within(nav).queryByRole("combobox")).toBeNull(); // no page-size selector
    expect(nav.querySelector("select")).toBeNull();
    expect(screen.getByRole("button", { name: "Previous" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Next" })).toHaveProperty("disabled", false);

    // Page 2.
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Page 2 of 3")).toBeTruthy();
    expect(api.fetchStaffActions).toHaveBeenNthCalledWith(2, TICKET, 2, 10);
    expect(screen.getAllByRole("listitem")).toHaveLength(10);
    expect(screen.getByText("Action item 11")).toBeTruthy();
    expect(screen.getByText("Action item 20")).toBeTruthy();
    expect(screen.queryByText("Action item 1")).toBeNull();
    expect(screen.getByRole("button", { name: "Previous" })).toHaveProperty("disabled", false);
    expect(screen.getByRole("button", { name: "Next" })).toHaveProperty("disabled", false);

    // Page 3 — last page boundary.
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Page 3 of 3")).toBeTruthy();
    expect(api.fetchStaffActions).toHaveBeenNthCalledWith(3, TICKET, 3, 10);
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText("Action item 21")).toBeTruthy(); // all 21 reachable
    expect(screen.getByRole("button", { name: "Next" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Previous" })).toHaveProperty("disabled", false);
    expect(container.querySelector("nav.action-pagination")).toBeTruthy();
  });

  it("AC-04 — one page shows Page 1 of 1 but no Previous/Next controls", async () => {
    vi.mocked(api.fetchStaffActions).mockImplementation(async (_tn, page = 1) =>
      pageOf(STAFF_21.slice(0, 5), page),
    );
    const { container } = render(<StaffActionsTaken ticketNumber={TICKET} ticketStatus="OPEN" />);

    expect(await screen.findByText("Page 1 of 1")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Previous" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
    expect(container.querySelector("nav.action-pagination")).toBeTruthy();
  });

  it("AC-04 — zero results render no pagination nav at all", async () => {
    const { container } = render(<StaffActionsTaken ticketNumber={TICKET} ticketStatus="OPEN" />);

    await screen.findByText("No Actions recorded for this Ticket.");
    expect(screen.queryByRole("navigation", { name: "Actions pages" })).toBeNull();
    expect(container.querySelector("nav.action-pagination")).toBeNull();
  });

  it("AC-04 — an emptied current page falls back to page 1", async () => {
    vi.mocked(api.fetchStaffActions).mockImplementation(async (_tn, page = 1) => {
      if (page === 1) return pageOf(STAFF_15, 1);
      return { data: [], pagination: { page: 2, pageSize: 10, totalItems: 15, totalPages: 2 } };
    });
    render(<StaffActionsTaken ticketNumber={TICKET} ticketStatus="OPEN" />);

    await screen.findByText("Page 1 of 2");
    await userEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => expect(api.fetchStaffActions).toHaveBeenCalledTimes(3));
    expect(api.fetchStaffActions).toHaveBeenLastCalledWith(TICKET, 1, 10);
    expect(screen.queryByText(/No Actions recorded/)).toBeNull();
    expect(screen.queryByText("Page 2 of 2")).toBeNull();
    expect(await screen.findByText("Action item 1")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Create save and list refresh (FR-18, FR-19)
// ---------------------------------------------------------------------------

describe("UI-ACT-01 — Create save and list refresh (FR-18, FR-19)", () => {
  it("FR-18 — a successful create re-fetches the SAME page and sends the normalized payload", async () => {
    vi.mocked(api.fetchStaffActions).mockImplementation(async (_tn, page = 1) => pageOf(STAFF_15, page));
    render(<StaffActionsTaken ticketNumber={TICKET} ticketStatus="OPEN" />);

    await screen.findByText("Page 1 of 2");
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Page 2 of 2");

    await userEvent.click(screen.getByRole("button", { name: "Add Action" }));
    await screen.findByRole("heading", { level: 3, name: "Add Action" });
    await userEvent.type(screen.getByLabelText(/Description/), "New action on page two");
    await userEvent.click(screen.getByRole("button", { name: "Record Action" }));

    await waitFor(() => expect(api.createTicketAction).toHaveBeenCalledTimes(1));
    expect(api.createTicketAction).toHaveBeenCalledWith(
      TICKET,
      expect.objectContaining({ description: "New action on page two" }),
      expect.any(String),
    );
    await waitFor(() => expect(api.fetchStaffActions).toHaveBeenCalledTimes(3));
    expect(api.fetchStaffActions).toHaveBeenLastCalledWith(TICKET, 2, 10);
  });

  it("FR-18 — a saved Action whose refresh fails keeps the write and never re-invokes a mutation", async () => {
    vi.mocked(api.fetchStaffActions)
      .mockResolvedValueOnce({
        data: [staffAction({ id: 1, description: "Existing action" })],
        pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
      })
      .mockRejectedValueOnce(new Error("Refresh failed"));
    vi.mocked(api.createTicketAction).mockResolvedValue(
      staffAction({ id: 77, description: "New action text" }),
    );
    render(<StaffActionsTaken ticketNumber={TICKET} ticketStatus="OPEN" />);

    await screen.findByText("Existing action");
    await userEvent.click(screen.getByRole("button", { name: "Add Action" }));
    await userEvent.type(screen.getByLabelText(/Description/), "New action text");
    await userEvent.click(screen.getByRole("button", { name: "Record Action" }));

    await waitFor(() => expect(api.createTicketAction).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(api.fetchStaffActions).toHaveBeenCalledTimes(2));
    expect(api.createTicketAction).toHaveBeenCalledTimes(1); // committed write is not repeated
    expect(api.updateTicketAction).not.toHaveBeenCalled();

    // Contract (ui-spec §3, FR-18): the failed refresh is reported as a
    // save-then-refresh warning inside an error-box WITH a Retry button —
    // not as a plain read error — and the committed write is never repeated.
    const alert = await screen.findByRole("alert");
    expect(alert.className).toContain("error-box");
    expect(alert.textContent).toContain(
      "The Action was saved, but the list could not be refreshed.",
    );
    expect(within(alert).getByRole("button", { name: "Retry" })).toBeTruthy();
    expect(api.createTicketAction).toHaveBeenCalledTimes(1);

    // B2 — the newly committed Action stays represented by the section-level
    // success snapshot even though the list refresh failed.
    const notice = await screen.findByText("Action recorded successfully");
    const box = notice.closest('[role="status"]') as HTMLElement;
    expect(box).toBeTruthy();
    expect(box.textContent).toContain("New action text");
    expect(box.textContent).toContain("Pending");
    expect(box.textContent).toContain("Alice");

    // Retry re-reads only; it never replays the POST.
    await userEvent.click(within(alert).getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(api.fetchStaffActions).toHaveBeenCalledTimes(3));
    expect(api.createTicketAction).toHaveBeenCalledTimes(1);
    expect(api.updateTicketAction).not.toHaveBeenCalled();
  });

  it("FR-18 — a stale page read resolving AFTER the post-mutation refresh never overwrites the fresh list", async () => {
    let resolveStale!: (value: api.ActionListResponse<api.StaffActionDto>) => void;
    const staleRead = new Promise<api.ActionListResponse<api.StaffActionDto>>((resolve) => {
      resolveStale = resolve;
    });

    vi.mocked(api.fetchStaffActions)
      .mockResolvedValueOnce(pageOf(STAFF_15, 1)) // initial read
      .mockImplementationOnce(() => staleRead) // older ordinary read, still in flight
      .mockResolvedValueOnce({
        // newer post-mutation refresh
        data: [staffAction({ id: 100, description: "New action text" })],
        pagination: { page: 2, pageSize: 10, totalItems: 11, totalPages: 2 },
      });
    vi.mocked(api.createTicketAction).mockResolvedValue(
      staffAction({ id: 100, description: "New action text" }),
    );

    render(<StaffActionsTaken ticketNumber={TICKET} ticketStatus="OPEN" />);
    await screen.findByText("Page 1 of 2");

    // An ordinary page read starts and stays pending while cached items show.
    await userEvent.click(screen.getByRole("button", { name: "Next" }));

    // Commit an Action while that older read is still in flight.
    await userEvent.click(screen.getByRole("button", { name: "Add Action" }));
    await userEvent.type(screen.getByLabelText(/Description/), "New action text");
    await userEvent.click(screen.getByRole("button", { name: "Record Action" }));
    await waitFor(() => expect(api.createTicketAction).toHaveBeenCalledTimes(1));
    await screen.findByText("New action text"); // fresh refresh result is rendered

    // The older request now resolves with stale data — it must be ignored.
    await act(async () => {
      resolveStale({
        data: [staffAction({ id: 999, description: "Stale page two item" })],
        pagination: { page: 2, pageSize: 10, totalItems: 1, totalPages: 1 },
      });
    });

    expect(screen.queryByText("Stale page two item")).toBeNull();
    expect(screen.getByText("New action text")).toBeTruthy();
    expect(api.createTicketAction).toHaveBeenCalledTimes(1);
    expect(api.updateTicketAction).not.toHaveBeenCalled();
  });

  it("FR-18 — a failed post-mutation refresh recovers the UI and ignores an older in-flight read", async () => {
    let resolveStale!: (value: api.ActionListResponse<api.StaffActionDto>) => void;
    const staleRead = new Promise<api.ActionListResponse<api.StaffActionDto>>((resolve) => {
      resolveStale = resolve;
    });

    vi.mocked(api.fetchStaffActions)
      .mockResolvedValueOnce(pageOf(STAFF_15, 1)) // initial read; cached items stay visible
      .mockImplementationOnce(() => staleRead) // older ordinary read, still pending
      .mockRejectedValueOnce(new Error("Refresh failed")); // post-mutation refresh fails
    vi.mocked(api.createTicketAction).mockResolvedValue(
      staffAction({ id: 77, description: "Committed action" }),
    );

    render(<StaffActionsTaken ticketNumber={TICKET} ticketStatus="OPEN" />);
    await screen.findByText("Page 1 of 2");

    await userEvent.click(screen.getByRole("button", { name: "Next" })); // older read in flight
    await userEvent.click(screen.getByRole("button", { name: "Add Action" }));
    await userEvent.type(screen.getByLabelText(/Description/), "Committed action");
    await userEvent.click(screen.getByRole("button", { name: "Record Action" }));

    await waitFor(() => expect(api.createTicketAction).toHaveBeenCalledTimes(1));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(
      "The Action was saved, but the list could not be refreshed.",
    );

    // Cached state survives and the section is never stuck on "Updating Actions…".
    expect(screen.getByText("Action item 1")).toBeTruthy();
    expect(screen.queryByText("Updating Actions…")).toBeNull();

    // The older read resolves afterwards with stale data — it must be ignored.
    await act(async () => {
      resolveStale({
        data: [staffAction({ id: 999, description: "Stale page two item" })],
        pagination: { page: 2, pageSize: 10, totalItems: 1, totalPages: 1 },
      });
    });

    expect(screen.queryByText("Stale page two item")).toBeNull();
    expect(screen.getByText("Action item 1")).toBeTruthy();
    expect(screen.queryByText("Updating Actions…")).toBeNull();
    expect(
      screen
        .getAllByRole("alert")
        .some((node) =>
          node.textContent?.includes("The Action was saved, but the list could not be refreshed."),
        ),
    ).toBe(true);

    // The committed write is never repeated because a refresh failed.
    expect(api.createTicketAction).toHaveBeenCalledTimes(1);
    expect(api.updateTicketAction).not.toHaveBeenCalled();

    // B2 — the committed Action is still represented by the success snapshot.
    const notice = await screen.findByText("Action recorded successfully");
    expect(notice.closest('[role="status"]')!.textContent).toContain("Committed action");
  });

  it("FR-18/AC-21 — a successful edit announces success at the section level after the form closes", async () => {
    const existing = staffAction({ id: 1, description: "Existing action" });
    const updated = staffAction({
      id: 1,
      description: "Existing action",
      result: "Fixed",
      status: "COMPLETED",
      version: 2,
      performedBy: { id: 5, name: "Alice" },
      updatedAt: "2026-09-12T09:00:00Z",
    });
    vi.mocked(api.fetchStaffActions)
      .mockResolvedValueOnce({
        data: [existing],
        pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
      })
      .mockResolvedValueOnce({
        data: [updated],
        pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
      });
    vi.mocked(api.updateTicketAction).mockResolvedValue(updated);
    render(<StaffActionsTaken ticketNumber={TICKET} ticketStatus="OPEN" />);

    await screen.findByText("Existing action");
    await userEvent.click(screen.getByRole("button", { name: "Edit Action" }));
    await screen.findByRole("heading", { level: 3, name: "Edit Action" });
    await userEvent.click(screen.getByRole("button", { name: "Save Action" }));

    await waitFor(() => expect(api.updateTicketAction).toHaveBeenCalledTimes(1));
    // B1 — the form is gone, yet the success announcement survives it.
    await waitFor(() =>
      expect(screen.queryByRole("heading", { level: 3, name: "Edit Action" })).toBeNull(),
    );
    const notice = await screen.findByText("Action updated successfully");
    const box = notice.closest('[role="status"]') as HTMLElement;
    expect(box).toBeTruthy();
    expect(box.textContent).toContain("Existing action");
    expect(box.textContent).toContain("Completed");
    expect(box.textContent).toContain("Alice");
    expect(box.textContent).toContain("2026-09-10 00:00:00 UTC");
    expect(api.updateTicketAction).toHaveBeenCalledTimes(1);
  });

  it("FR-18 — an edit whose refresh fails keeps the committed success and never repeats PATCH", async () => {
    const existing = staffAction({ id: 1, description: "Existing action" });
    const updated = staffAction({ id: 1, description: "Edited action", version: 2 });
    vi.mocked(api.fetchStaffActions)
      .mockResolvedValueOnce({
        data: [existing],
        pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
      })
      .mockRejectedValueOnce(new Error("Refresh failed"));
    vi.mocked(api.updateTicketAction).mockResolvedValue(updated);
    render(<StaffActionsTaken ticketNumber={TICKET} ticketStatus="OPEN" />);

    await screen.findByText("Existing action");
    await userEvent.click(screen.getByRole("button", { name: "Edit Action" }));
    await screen.findByRole("heading", { level: 3, name: "Edit Action" });
    await userEvent.click(screen.getByRole("button", { name: "Save Action" }));

    await waitFor(() => expect(api.updateTicketAction).toHaveBeenCalledTimes(1));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(
      "The Action was saved, but the list could not be refreshed.",
    );
    const notice = await screen.findByText("Action updated successfully");
    expect(notice.closest('[role="status"]')!.textContent).toContain("Edited action");
    expect(api.updateTicketAction).toHaveBeenCalledTimes(1);

    // Retry re-reads only; the PATCH is never replayed.
    await userEvent.click(within(alert).getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(api.fetchStaffActions).toHaveBeenCalledTimes(3));
    expect(api.updateTicketAction).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Requester read-only area (AC-07; FR-06)
// ---------------------------------------------------------------------------

describe("UI-ACT-01 — Requester read-only area (AC-07, FR-06)", () => {
  it("AC-07 — shows the labeled loading state", () => {
    vi.mocked(api.fetchRequesterActions).mockImplementation(
      () => new Promise<api.ActionListResponse<api.RequesterActionDto>>(() => {}),
    );
    const { container } = render(<RequesterActionsTaken ticketNumber={TICKET} />);

    expect(screen.getByRole("status", { name: "Loading Actions" })).toBeTruthy();
    expect(container.querySelector("section.actions-taken.requester-actions-taken")).toBeTruthy();
  });

  it("AC-07 — shows the zero-Action empty state via the requester projection", async () => {
    render(<RequesterActionsTaken ticketNumber={TICKET} />);

    expect(await screen.findByText("No Actions recorded for this Ticket.")).toBeTruthy();
    expect(api.fetchRequesterActions).toHaveBeenCalledWith(TICKET, 1, 10);
    expect(api.fetchStaffActions).not.toHaveBeenCalled();
    expect(screen.queryByRole("navigation", { name: "Actions pages" })).toBeNull();
  });

  it("AC-07 — 403 renders access denied with no Retry", async () => {
    vi.mocked(api.fetchRequesterActions).mockRejectedValue(apiError(403, "Forbidden"));
    render(<RequesterActionsTaken ticketNumber={TICKET} />);

    expect(await screen.findByText("You do not have permission to view Actions for this Ticket.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });

  it("AC-07 — renders performer/assignee names, status, dates, and read-only cards", async () => {
    vi.mocked(api.fetchRequesterActions).mockResolvedValue({
      data: [
        requesterAction({
          id: 3,
          description: "Printer queue cleared",
          result: "Queue rebuilt",
          followUpRequired: true,
          followUpNote: "Watch for recurrence",
          attachmentNotes: "Photo attached",
          status: "PENDING",
        }),
      ],
      pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
    });
    const { container } = render(<RequesterActionsTaken ticketNumber={TICKET} />);

    expect(await screen.findByText("Printer queue cleared")).toBeTruthy();
    expect(container.querySelector("section.actions-taken.requester-actions-taken")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Actions Taken" })).toBeTruthy();
    expect(api.fetchRequesterActions).toHaveBeenCalledWith(TICKET, 1, 10);
    expect(api.fetchStaffActions).not.toHaveBeenCalled();
    expect(api.fetchAssignableOwners).not.toHaveBeenCalled(); // no owner-list dependency

    const card = container.querySelector("li.action-card.action-card-readonly") as HTMLElement;
    expect(card).toBeTruthy();
    const w = within(card);
    expect(w.getByText("Pending")).toBeTruthy(); // status as text
    expect(w.getByText("Queue rebuilt")).toBeTruthy(); // Result
    expect(w.getByText("Yes")).toBeTruthy(); // follow-up indicator
    expect(w.getByText("Follow-up Note")).toBeTruthy();
    expect(w.getByText("Watch for recurrence")).toBeTruthy();
    expect(w.getByText("Photo attached")).toBeTruthy(); // Attachment Notes
    expect(w.getByText("Performed by")).toBeTruthy();
    expect(w.getByText("Alice")).toBeTruthy(); // performer display name
    expect(w.getByText("Assignee")).toBeTruthy();
    expect(w.getByText("Bob")).toBeTruthy(); // assignee display name
    expect(w.getByText("2026-09-10 00:00:00 UTC")).toBeTruthy(); // created date
  });

  it("AC-07 — never renders controls, user ids, role, version, Internal Note, or audit fields", async () => {
    const leaky = {
      ...requesterAction({ id: 7, description: "Queue rebuilt" }),
      performedBy: { name: "Alice", id: 555 },
      assignee: { name: "Bob", id: 666, role: "IT_STAFF" },
      version: 42,
    } as api.RequesterActionDto;
    vi.mocked(api.fetchRequesterActions).mockResolvedValue({
      data: [leaky],
      pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
    });
    const { container } = render(<RequesterActionsTaken ticketNumber={TICKET} />);
    await screen.findByText("Queue rebuilt");

    // No write/assignment control of any kind.
    for (const name of [
      "Edit Action",
      "View Action",
      "Add Action",
      "Record Action",
      "Save Action",
      "Assign",
      "Complete",
      "Cancel",
    ]) {
      expect(screen.queryByRole("button", { name })).toBeNull();
    }
    expect(container.querySelector("button, input, select, textarea")).toBeNull();

    // No staff-only metadata or private content.
    expect(screen.queryByText("555")).toBeNull(); // performer id
    expect(screen.queryByText("666")).toBeNull(); // assignee id
    expect(screen.queryByText("42")).toBeNull(); // version
    expect(screen.queryByText("7")).toBeNull(); // action id
    expect(screen.queryByText(/IT_STAFF|ADMINISTRATOR/)).toBeNull(); // assignee role
    expect(screen.queryByText(/version/i)).toBeNull();
    expect(screen.queryByText(/Internal Note/)).toBeNull();
    expect(screen.queryByText(/revision|audit/i)).toBeNull();
  });

  it("AC-04 — walks 21 requester Actions across three fixed-size-10 pages", async () => {
    vi.mocked(api.fetchRequesterActions).mockImplementation(async (_tn, page = 1) =>
      pageOf(REQUESTER_21, page),
    );
    render(<RequesterActionsTaken ticketNumber={TICKET} />);

    expect(await screen.findByText("Page 1 of 3")).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(10);
    expect(screen.getByRole("button", { name: "Previous" })).toHaveProperty("disabled", true);

    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Page 2 of 3")).toBeTruthy();
    expect(api.fetchRequesterActions).toHaveBeenNthCalledWith(2, TICKET, 2, 10);
    expect(screen.getByText("Action item 11")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Page 3 of 3")).toBeTruthy();
    expect(api.fetchRequesterActions).toHaveBeenNthCalledWith(3, TICKET, 3, 10);
    expect(screen.getByText("Action item 21")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Previous" })).toHaveProperty("disabled", false);
    expect(screen.queryByRole("combobox")).toBeNull(); // no page-size selector
  });
});

// ---------------------------------------------------------------------------
// ActionForm client validation (AC-21; BR-05, BR-04)
// ---------------------------------------------------------------------------

describe("UI-ACT-01 — ActionForm client validation (AC-21, BR-05, BR-04)", () => {
  it.each(["", "   "])(
    "BR-05 — %j description fails with Description is required and no API call",
    async (value) => {
      render(<ActionForm ticketNumber={TICKET} action={null} onSaved={vi.fn()} onCancel={vi.fn()} />);
      if (value.length > 0) {
        await userEvent.type(screen.getByLabelText(/Description/), value);
      }
      await userEvent.click(screen.getByRole("button", { name: "Record Action" }));

      const error = await screen.findByText("Description is required.");
      expect(error.getAttribute("role")).toBe("alert");
      expect(error.id).toBe("action-description-error");
      expect(api.createTicketAction).not.toHaveBeenCalled();
      expect(api.updateTicketAction).not.toHaveBeenCalled();
    },
  );

  it("BR-05 — description over 2000 characters fails with the exact bound message", async () => {
    render(<ActionForm ticketNumber={TICKET} action={null} onSaved={vi.fn()} onCancel={vi.fn()} />);
    setTextValue(document.getElementById("action-description") as HTMLTextAreaElement, "a".repeat(2001));
    await userEvent.click(screen.getByRole("button", { name: "Record Action" }));

    const error = await screen.findByText("Description must be 2000 characters or fewer.");
    expect(error.getAttribute("role")).toBe("alert");
    expect(error.id).toBe("action-description-error");
    expect(api.createTicketAction).not.toHaveBeenCalled();
  });

  it("BR-05 — checked follow-up with a blank note fails validation", async () => {
    render(<ActionForm ticketNumber={TICKET} action={null} onSaved={vi.fn()} onCancel={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/Description/), "Has a follow-up");
    await userEvent.click(screen.getByLabelText("Follow-up Required"));
    await screen.findByLabelText(/Follow-up Note/);
    await userEvent.click(screen.getByRole("button", { name: "Record Action" }));

    const error = await screen.findByText("Follow-up note is required when follow-up is required.");
    expect(error.getAttribute("role")).toBe("alert");
    expect(error.id).toBe("action-followup-note-error");
    expect(api.createTicketAction).not.toHaveBeenCalled();
  });

  it("BR-04 — completing an Action without a Result fails validation (AC-06)", async () => {
    render(
      <ActionForm
        ticketNumber={TICKET}
        action={staffAction({ id: 42, version: 3 })}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByLabelText("Completed"));
    await userEvent.click(screen.getByRole("button", { name: "Save Action" }));

    const error = await screen.findByText("Result is required to complete an Action.");
    expect(error.getAttribute("role")).toBe("alert");
    expect(error.id).toBe("action-result-error");
    expect(api.updateTicketAction).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Create success and payload normalization (AC-21; BR-05, BR-25)
// ---------------------------------------------------------------------------

describe("UI-ACT-01 — Create success and payload normalization (AC-21, BR-05, BR-25)", () => {
  it("AC-21 — successful create clears the form and hands the committed Action to the section", async () => {
    const saved = staffAction({
      id: 77,
      description: "New action text",
      createdAt: "2026-09-12T08:30:00Z",
      performedBy: { id: 5, name: "Alice" },
    });
    vi.mocked(api.createTicketAction).mockResolvedValue(saved);
    const onSaved = vi.fn();
    render(<ActionForm ticketNumber={TICKET} action={null} onSaved={onSaved} onCancel={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/Description/), "New action text");
    await userEvent.click(screen.getByRole("button", { name: "Record Action" }));

    await waitFor(() => expect(api.createTicketAction).toHaveBeenCalledTimes(1));
    expect(api.createTicketAction).toHaveBeenCalledWith(
      TICKET,
      {
        description: "New action text",
        result: null,
        followUpRequired: false,
        followUpNote: null,
        attachmentNotes: null,
        assigneeUserId: null,
      },
      expect.any(String),
    );
    // Success is owned by the Actions section (so it survives this form);
    // the form only reports the committed server response and clears itself.
    expect(screen.queryByText(/Action recorded/)).toBeNull();
    expect(onSaved).toHaveBeenCalledWith(saved, "create");
    expect((document.getElementById("action-description") as HTMLTextAreaElement).value).toBe("");
    expect((document.getElementById("action-assignee") as HTMLSelectElement).value).toBe("");
  });

  it("BR-05 — unchecking follow-up sends followUpNote: null and trims the description", async () => {
    render(<ActionForm ticketNumber={TICKET} action={null} onSaved={vi.fn()} onCancel={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/Description/), "  Padded note  ");
    await userEvent.click(screen.getByLabelText("Follow-up Required"));
    await userEvent.type(screen.getByLabelText(/Follow-up Note/), "Call them back");
    await userEvent.click(screen.getByLabelText("Follow-up Required")); // toggle OFF
    await userEvent.click(screen.getByRole("button", { name: "Record Action" }));

    await waitFor(() => expect(api.createTicketAction).toHaveBeenCalledTimes(1));
    expect(api.createTicketAction).toHaveBeenCalledWith(
      TICKET,
      {
        description: "Padded note",
        result: null,
        followUpRequired: false,
        followUpNote: null,
        attachmentNotes: null,
        assigneeUserId: null,
      },
      expect.any(String),
    );
  });

  it("FR-18 — starting another create retires the previous success so stale success never shows with a later failure", async () => {
    vi.mocked(api.createTicketAction)
      .mockResolvedValueOnce(staffAction({ id: 77, description: "First" }))
      .mockRejectedValueOnce(apiError(500, "Second attempt failed"));
    render(<StaffActionsTaken ticketNumber={TICKET} ticketStatus="OPEN" />);
    await screen.findByText("No Actions recorded for this Ticket.");

    // First create succeeds: the SECTION announces it and it survives Cancel.
    await userEvent.click(screen.getByRole("button", { name: "Add Action" }));
    await userEvent.type(screen.getByLabelText(/Description/), "First");
    await userEvent.click(screen.getByRole("button", { name: "Record Action" }));
    await screen.findByText("Action recorded successfully");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText("Action recorded successfully")).toBeTruthy();

    // Starting another create retires the old success snapshot.
    await userEvent.click(screen.getByRole("button", { name: "Add Action" }));
    expect(screen.queryByText("Action recorded successfully")).toBeNull();

    // The next logical create fails: no success may appear beside the error.
    await userEvent.type(screen.getByLabelText(/Description/), "Second");
    await userEvent.click(screen.getByRole("button", { name: "Record Action" }));
    expect(await screen.findByText("Second attempt failed")).toBeTruthy();
    expect(screen.queryByText("Action recorded successfully")).toBeNull();
    expect(screen.getByRole("alert").textContent).toContain("Second attempt failed");
  });
});

// ---------------------------------------------------------------------------
// Create idempotency (AC-21; BR-25)
// ---------------------------------------------------------------------------

describe("UI-ACT-01 — Create idempotency (AC-21, BR-25)", () => {
  it("BR-25 — an unchanged retry reuses the SAME idempotency key and keeps the input", async () => {
    vi.mocked(api.createTicketAction)
      .mockRejectedValueOnce(apiError(500, "Network hiccup"))
      .mockResolvedValue(staffAction({ id: 77, description: "Retry me" }));
    render(<ActionForm ticketNumber={TICKET} action={null} onSaved={vi.fn()} onCancel={vi.fn()} />);

    const desc = screen.getByLabelText(/Description/) as HTMLTextAreaElement;
    await userEvent.type(desc, "Retry me");
    await userEvent.click(screen.getByRole("button", { name: "Record Action" }));
    expect(await screen.findByText("Network hiccup")).toBeTruthy();
    expect(desc.value).toBe("Retry me"); // recoverable input retained

    await userEvent.click(screen.getByRole("button", { name: "Record Action" }));
    await waitFor(() => expect(api.createTicketAction).toHaveBeenCalledTimes(2));

    const calls = vi.mocked(api.createTicketAction).mock.calls;
    expect(typeof calls[0][2]).toBe("string");
    expect(calls[0][2]).not.toBe("");
    expect(calls[1][2]).toBe(calls[0][2]);
  });

  it("BR-25 — changing a field rotates the idempotency key", async () => {
    vi.mocked(api.createTicketAction)
      .mockRejectedValueOnce(apiError(500, "Network hiccup"))
      .mockResolvedValue(staffAction({ id: 78, description: "Changed" }));
    render(<ActionForm ticketNumber={TICKET} action={null} onSaved={vi.fn()} onCancel={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/Description/), "First attempt");
    await userEvent.click(screen.getByRole("button", { name: "Record Action" }));
    await screen.findByText("Network hiccup");

    await userEvent.type(screen.getByLabelText(/Description/), "!");
    await userEvent.click(screen.getByRole("button", { name: "Record Action" }));
    await waitFor(() => expect(api.createTicketAction).toHaveBeenCalledTimes(2));

    const calls = vi.mocked(api.createTicketAction).mock.calls;
    expect(calls[1][2]).not.toBe(calls[0][2]);
    expect(calls[1][1].description).toBe("First attempt!");
  });

  it("BR-25 — double-clicking submit issues exactly one createTicketAction", async () => {
    vi.mocked(api.createTicketAction).mockImplementation(
      () => new Promise<api.StaffActionDto>(() => {}),
    );
    render(<ActionForm ticketNumber={TICKET} action={null} onSaved={vi.fn()} onCancel={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/Description/), "Click twice");
    const submit = screen.getByRole("button", { name: "Record Action" });
    await userEvent.click(submit);
    await userEvent.click(submit);

    expect(api.createTicketAction).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Saving…" })).toHaveProperty("disabled", true);
  });
});

// ---------------------------------------------------------------------------
// Edit conflict (AC-21; BR-24)
// ---------------------------------------------------------------------------

describe("UI-ACT-01 — Edit conflict (AC-21, BR-24)", () => {
  it("BR-24 — sends expectedVersion, never auto-retries the 409, retains values, and reviews latest", async () => {
    render(
      <ActionForm
        ticketNumber={TICKET}
        action={staffAction({ id: 42, version: 3, description: "Original description" })}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const desc = screen.getByLabelText(/Description/) as HTMLTextAreaElement;
    await waitFor(() => expect((screen.getByLabelText("Assignee") as HTMLSelectElement).disabled).toBe(false));
    await userEvent.clear(desc);
    await userEvent.type(desc, "Draft text");
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy(); // edit → Save + Cancel
    vi.mocked(api.updateTicketAction).mockRejectedValueOnce(apiError(409, "The Action was changed by someone else."));
    await userEvent.click(screen.getByRole("button", { name: "Save Action" }));

    expect(await screen.findByText("The Action was changed by someone else.")).toBeTruthy();
    expect(api.updateTicketAction).toHaveBeenCalledTimes(1); // no automatic second PATCH
    expect(api.updateTicketAction).toHaveBeenCalledWith(
      TICKET,
      42,
      expect.objectContaining({ expectedVersion: 3, description: "Draft text" }),
    );
    expect(desc.value).toBe("Draft text"); // recoverable draft retained

    // Explicit review step fetches the authoritative latest Action.
    vi.mocked(api.fetchActionDetail).mockResolvedValue(
      staffAction({ id: 42, version: 4, description: "Server latest", status: "PENDING", result: "Fixed" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Review latest Action" }));
    expect(await screen.findByText("Server latest")).toBeTruthy();
    expect(document.querySelector(".conflict-latest")).toBeTruthy();
    expect(screen.getByText("4")).toBeTruthy(); // latest version shown
    expect(api.updateTicketAction).toHaveBeenCalledTimes(1); // still only one PATCH

    // BR-24 lossless reconciliation: the dirty Description keeps the draft,
    // the untouched Result takes the latest server value, and the retry sends
    // both at the NEW version.
    expect(desc.value).toBe("Draft text");
    expect((screen.getByLabelText("Result") as HTMLTextAreaElement).value).toBe("Fixed");

    vi.mocked(api.updateTicketAction).mockResolvedValue(
      staffAction({ id: 42, version: 5, description: "Draft text", result: "Fixed" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Save Action" }));
    await waitFor(() => expect(api.updateTicketAction).toHaveBeenCalledTimes(2));
    expect(api.updateTicketAction).toHaveBeenLastCalledWith(
      TICKET,
      42,
      expect.objectContaining({ expectedVersion: 4, description: "Draft text", result: "Fixed" }),
    );
  });

  it("BR-24 — a message-less 409 falls back to the Action-changed explanation", async () => {
    render(
      <ActionForm
        ticketNumber={TICKET}
        action={staffAction({ id: 42 })}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    vi.mocked(api.updateTicketAction).mockRejectedValue(apiError(409, ""));
    await userEvent.click(screen.getByRole("button", { name: "Save Action" }));

    expect(await screen.findByText(/The Action changed since you loaded it/)).toBeTruthy();
    expect(api.updateTicketAction).toHaveBeenCalledTimes(1);
    expect((screen.getByLabelText(/Description/) as HTMLTextAreaElement).value).toBe(
      "Checked the print queue",
    );
  });

  it("BR-24 — conflict review reconciles untouched fields from the latest Action and keeps dirty draft fields", async () => {
    render(
      <ActionForm
        ticketNumber={TICKET}
        action={staffAction({ id: 42, version: 1, description: "Original" })}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    // The user changes ONLY the Description; Follow-up Note and Attachment
    // Notes stay untouched.
    const desc = screen.getByLabelText(/Description/) as HTMLTextAreaElement;
    await userEvent.clear(desc);
    await userEvent.type(desc, "My draft");

    vi.mocked(api.updateTicketAction).mockRejectedValueOnce(apiError(409, "Stale version."));
    await userEvent.click(screen.getByRole("button", { name: "Save Action" }));
    await screen.findByText("Stale version.");

    // Another staff member meanwhile changed Follow-up Note + Attachment Notes
    // (and flipped follow-up on), producing version 2.
    vi.mocked(api.fetchActionDetail).mockResolvedValue(
      staffAction({
        id: 42,
        version: 2,
        description: "Original",
        followUpRequired: true,
        followUpNote: "Peer's newer note",
        attachmentNotes: "Peer's newer attachment note",
      }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Review latest Action" }));

    // Dirty Description keeps the draft; untouched fields take the latest
    // server values — including fields the review panel did not display.
    await waitFor(() => expect(desc.value).toBe("My draft"));
    expect(screen.getByLabelText("Follow-up Required")).toHaveProperty("checked", true);
    expect((screen.getByLabelText(/Follow-up Note/) as HTMLTextAreaElement).value).toBe(
      "Peer's newer note",
    );
    expect((screen.getByLabelText(/Attachment Notes/) as HTMLTextAreaElement).value).toBe(
      "Peer's newer attachment note",
    );

    // The review panel shows ALL editable latest fields, not just a subset.
    const panel = document.querySelector(".conflict-latest") as HTMLElement;
    expect(panel.textContent).toContain("Peer's newer note");
    expect(panel.textContent).toContain("Peer's newer attachment note");

    // The retry sends the NEW version with latest untouched values and the
    // user's dirty value — the peer's concurrent changes are not clobbered.
    vi.mocked(api.updateTicketAction).mockResolvedValue(staffAction({ id: 42, version: 3 }));
    await userEvent.click(screen.getByRole("button", { name: "Save Action" }));
    await waitFor(() => expect(api.updateTicketAction).toHaveBeenCalledTimes(2));
    expect(api.updateTicketAction).toHaveBeenLastCalledWith(
      TICKET,
      42,
      expect.objectContaining({
        expectedVersion: 2,
        description: "My draft",
        followUpRequired: true,
        followUpNote: "Peer's newer note",
        attachmentNotes: "Peer's newer attachment note",
      }),
    );
  });

  it("BR-24 — a create-time 409 preserves the draft and never renders a dead Review-latest control", async () => {
    render(<ActionForm ticketNumber={TICKET} action={null} onSaved={vi.fn()} onCancel={vi.fn()} />);

    const desc = screen.getByLabelText(/Description/) as HTMLTextAreaElement;
    await userEvent.type(desc, "Created after the Ticket closed");

    // e.g. the Ticket became terminal, or the assignee became ineligible,
    // between opening the Add form and submitting.
    vi.mocked(api.createTicketAction).mockRejectedValue(
      apiError(409, "A Pending Action cannot be created on a resolved, closed, or cancelled Ticket."),
    );
    await userEvent.click(screen.getByRole("button", { name: "Record Action" }));

    // Canonical server message, draft retained, NO stale-Action review state.
    expect(
      await screen.findByText(
        "A Pending Action cannot be created on a resolved, closed, or cancelled Ticket.",
      ),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Review latest Action" })).toBeNull();
    expect(document.querySelector(".conflict-box")).toBeNull();
    expect(desc.value).toBe("Created after the Ticket closed");
    expect(api.fetchActionDetail).not.toHaveBeenCalled();
    expect(api.updateTicketAction).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Assignee eligibility (AC-03; BR-03)
// ---------------------------------------------------------------------------

describe("UI-ACT-01 — Assignee eligibility (AC-03, BR-03)", () => {
  it("BR-03 — ineligible current assignee stays visible with a warning and blocks Save until reassigned", async () => {
    const action = staffAction({ id: 42, assignee: { id: 99, name: "Zoe", role: "IT_STAFF" } });
    const onSaved = vi.fn();
    render(<ActionForm ticketNumber={TICKET} action={action} onSaved={onSaved} onCancel={vi.fn()} />);

    const select = screen.getByLabelText("Assignee") as HTMLSelectElement;
    await waitFor(() => expect(select.disabled).toBe(false)); // owners resolved
    await screen.findByText(/no longer an active Staff\/Administrator/);
    expect(select.value).toBe("99");
    expect(screen.getByRole("option", { name: "Zoe (ineligible)" })).toBeTruthy();

    // Submitting without an explicit eligible reassignment is blocked.
    await userEvent.click(screen.getByRole("button", { name: "Save Action" }));
    const error = await screen.findByText(
      "The current assignee is no longer eligible. Choose an eligible assignee or unassign.",
    );
    expect(error.getAttribute("role")).toBe("alert");
    expect(api.updateTicketAction).not.toHaveBeenCalled();

    // Picking an eligible owner unblocks the save.
    await userEvent.selectOptions(select, "5");
    expect(screen.queryByText(/no longer an active Staff\/Administrator/)).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Save Action" }));

    await waitFor(() => expect(api.updateTicketAction).toHaveBeenCalledTimes(1));
    expect(api.updateTicketAction).toHaveBeenCalledWith(
      TICKET,
      42,
      expect.objectContaining({ assigneeUserId: 5, expectedVersion: 1 }),
    );
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it("BR-03 — owner lookup failure shows a Retry alert while keeping typed values", async () => {
    vi.mocked(api.fetchAssignableOwners).mockRejectedValueOnce(new Error("Owners unavailable"));
    render(<ActionForm ticketNumber={TICKET} action={null} onSaved={vi.fn()} onCancel={vi.fn()} />);

    await screen.findByText("Unable to load eligible assignees. Your entered values are kept.");
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Unable to load eligible assignees. Your entered values are kept.");
    expect(within(alert).getByRole("button", { name: "Retry" })).toBeTruthy();

    const desc = screen.getByLabelText(/Description/) as HTMLTextAreaElement;
    await userEvent.type(desc, "Kept while owners fail");
    expect(desc.value).toBe("Kept while owners fail");

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("option", { name: /Alice — IT Staff/ })).toBeTruthy();
    expect(screen.queryByText(/Unable to load eligible assignees/)).toBeNull();
    expect(desc.value).toBe("Kept while owners fail"); // values survive the retry
  });

  it("BR-03 — an edit-mode owner lookup failure keeps the assigned identity visible as eligibility-unknown", async () => {
    const action = staffAction({ id: 42, assignee: { id: 6, name: "Bob", role: "IT_STAFF" } });
    vi.mocked(api.fetchAssignableOwners).mockRejectedValueOnce(new Error("Owners unavailable"));
    render(<ActionForm ticketNumber={TICKET} action={action} onSaved={vi.fn()} onCancel={vi.fn()} />);

    // A failed lookup is NOT proof of ineligibility: Bob stays selected and is
    // labelled eligibility-unknown, never ineligible, and Retry is offered.
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(
      "Unable to load eligible assignees. Your entered values are kept.",
    );
    expect(within(alert).getByRole("button", { name: "Retry" })).toBeTruthy();

    const select = screen.getByLabelText("Assignee") as HTMLSelectElement;
    expect(select.value).toBe("6");
    expect(
      screen.getByRole("option", { name: "Bob (current — eligibility unavailable)" }),
    ).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Bob (ineligible)" })).toBeNull();
    expect(screen.queryByText(/no longer an active Staff\/Administrator/)).toBeNull();

    // The typed draft survives the failure and the retry.
    const desc = screen.getByLabelText(/Description/) as HTMLTextAreaElement;
    await userEvent.type(desc, "Draft kept through owner failure");
    expect(desc.value).toContain("Draft kept through owner failure");

    await userEvent.click(within(alert).getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("option", { name: "Bob — IT Staff" })).toBeTruthy();
    expect(screen.queryByText(/Unable to load eligible assignees/)).toBeNull();
    expect((screen.getByLabelText("Assignee") as HTMLSelectElement).value).toBe("6");
    expect(desc.value).toContain("Draft kept through owner failure");
  });

  it("BR-03 — a mid-session deactivation rejected by the server (HTTP 409) refreshes owners and requires explicit repair", async () => {
    // Owners are eligible when the form loads…
    const action = staffAction({ id: 42, assignee: { id: 6, name: "Bob", role: "IT_STAFF" } });
    render(<ActionForm ticketNumber={TICKET} action={action} onSaved={vi.fn()} onCancel={vi.fn()} />);

    const select = screen.getByLabelText("Assignee") as HTMLSelectElement;
    await waitFor(() => expect(select.disabled).toBe(false));
    expect(screen.queryByText(/no longer an active Staff\/Administrator/)).toBeNull();

    // The user reassigns to Alice — a DIFFERENT person from the persisted Bob.
    await userEvent.selectOptions(select, "5");
    expect(select.value).toBe("5");

    // …then Alice is deactivated before the PATCH lands. The server rejects
    // the write with HTTP 409 (ineligible assignee), not a version conflict.
    vi.mocked(api.updateTicketAction).mockRejectedValueOnce(
      apiError(409, "The specified assignee is not an active IT Staff or Administrator user."),
    );
    vi.mocked(api.fetchAssignableOwners).mockResolvedValue([OWNERS[1], OWNERS[2]]); // Alice gone
    await userEvent.click(screen.getByRole("button", { name: "Save Action" }));

    // Canonical server feedback and draft retained. This is an edit-mode
    // 409, so the explicit Review-latest workflow stays available — and that
    // review path is what refreshes the eligible-owner list (BR-03/BR-24).
    expect(
      await screen.findByText(
        "The specified assignee is not an active IT Staff or Administrator user.",
      ),
    ).toBeTruthy();
    expect((screen.getByLabelText(/Description/) as HTMLTextAreaElement).value).toBe(
      "Checked the print queue",
    );

    // Review latest Action returns the PERSISTED Bob Action and refreshes the
    // owner list without Alice. Because the assignee field is dirty, ALICE —
    // not Bob — must stay selected and be labelled by her own remembered
    // identity (BR-03/N1).
    vi.mocked(api.fetchActionDetail).mockResolvedValue(action);
    await userEvent.click(screen.getByRole("button", { name: "Review latest Action" }));
    await screen.findByText(/no longer an active Staff\/Administrator/);
    expect(select.value).toBe("5");
    expect(screen.getByRole("option", { name: "Alice (ineligible)" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Bob (ineligible)" })).toBeNull();

    // Resubmission stays blocked until the assignee is explicitly repaired.
    vi.mocked(api.updateTicketAction).mockClear();
    await userEvent.click(screen.getByRole("button", { name: "Save Action" }));
    expect(
      await screen.findByText(
        "The current assignee is no longer eligible. Choose an eligible assignee or unassign.",
      ),
    ).toBeTruthy();
    expect(api.updateTicketAction).not.toHaveBeenCalled();

    // Explicit repair (pick the eligible Bob) unblocks the save.
    await userEvent.selectOptions(select, "6");
    vi.mocked(api.updateTicketAction).mockResolvedValue(staffAction({ id: 42, version: 2 }));
    await userEvent.click(screen.getByRole("button", { name: "Save Action" }));
    await waitFor(() => expect(api.updateTicketAction).toHaveBeenCalledTimes(1));
    expect(api.updateTicketAction).toHaveBeenCalledWith(
      TICKET,
      42,
      expect.objectContaining({ assigneeUserId: 6, expectedVersion: 1 }),
    );
  });
});

// ---------------------------------------------------------------------------
// Terminal action (AC-06; BR-04)
// ---------------------------------------------------------------------------

describe("UI-ACT-01 — Terminal action (AC-06, BR-04)", () => {
  it("BR-04 — a completed Action opens a genuine read-only View surface with no Save, no editable fields, and no owner lookup", async () => {
    vi.mocked(api.fetchStaffActions).mockResolvedValue({
      data: [
        staffAction({
          id: 9,
          description: "Finished work",
          status: "COMPLETED",
          result: "Done",
          followUpRequired: true,
          followUpNote: "Watch the next 50 pages",
          attachmentNotes: "Serial photo attached",
        }),
      ],
      pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
    });
    render(<StaffActionsTaken ticketNumber={TICKET} ticketStatus="OPEN" />);

    await userEvent.click(await screen.findByRole("button", { name: "View Action" }));
    const view = await screen.findByRole("region", { name: "View Action" });

    // No edit surface at all: no Save, no form controls, no status radios.
    expect(screen.queryByRole("heading", { level: 3, name: "Edit Action" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Save Action" })).toBeNull();
    expect(screen.queryByLabelText(/Description/)).toBeNull();
    expect(screen.queryByLabelText("Assignee")).toBeNull();
    expect(document.getElementById("action-status-pending")).toBeNull();
    expect(document.getElementById("action-status-completed")).toBeNull();
    expect(document.getElementById("action-status-cancelled")).toBeNull();
    expect(document.getElementById("action-description")).toBeNull();

    // Current values are shown as text, including fields the old disabled
    // edit form left interactive (Description, Result, Follow-up, Notes).
    expect(view.textContent).toContain("Finished work");
    expect(view.textContent).toContain("Done");
    expect(view.textContent).toContain("Watch the next 50 pages");
    expect(view.textContent).toContain("Serial photo attached");
    expect(view.textContent).toContain("Completed");
    expect(view.textContent).toContain("read-only");

    // No mutation and no owner-list dependency for a terminal Action.
    expect(api.updateTicketAction).not.toHaveBeenCalled();
    expect(api.createTicketAction).not.toHaveBeenCalled();
    expect(api.fetchAssignableOwners).not.toHaveBeenCalled();

    // Close returns to the list.
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("region", { name: "View Action" })).toBeNull();
    expect(screen.getByRole("button", { name: "View Action" })).toBeTruthy();
  });

  it("BR-04/BR-27 — View Action works on a terminal Ticket while Add Action stays gated", async () => {
    vi.mocked(api.fetchStaffActions).mockResolvedValue({
      data: [staffAction({ id: 11, description: "Work on a resolved Ticket", status: "COMPLETED", result: "Done" })],
      pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
    });
    render(<StaffActionsTaken ticketNumber={TICKET} ticketStatus="RESOLVED" />);

    // BR-27 — no new Action, reopen guidance shown.
    await screen.findByText("Work on a resolved Ticket");
    expect(screen.queryByRole("button", { name: "Add Action" })).toBeNull();
    expect(screen.getByRole("note").textContent).toContain("Reopen it before recording new Actions.");

    // BR-04 — the existing terminal Action is still viewable (the old
    // implementation suppressed the form, making View a dead control).
    await userEvent.click(screen.getByRole("button", { name: "View Action" }));
    const view = await screen.findByRole("region", { name: "View Action" });
    expect(view.textContent).toContain("Work on a resolved Ticket");
    expect(screen.queryByRole("button", { name: "Save Action" })).toBeNull();
  });

  it("BR-04/BR-27 — a Pending Action remains editable on a Cancelled Ticket", async () => {
    vi.mocked(api.fetchStaffActions).mockResolvedValue({
      data: [staffAction({ id: 12, description: "Still pending on a cancelled Ticket" })],
      pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
    });
    render(<StaffActionsTaken ticketNumber={TICKET} ticketStatus="CANCELLED" />);

    // BR-27 — creation is gated…
    await screen.findByText("Still pending on a cancelled Ticket");
    expect(screen.queryByRole("button", { name: "Add Action" })).toBeNull();

    // …but the existing Pending Action keeps its edit path (the old
    // implementation hid the form, making Edit a dead control).
    await userEvent.click(await screen.findByRole("button", { name: "Edit Action" }));
    await screen.findByRole("heading", { level: 3, name: "Edit Action" });
    const desc = screen.getByLabelText(/Description/) as HTMLTextAreaElement;
    expect(desc.value).toBe("Still pending on a cancelled Ticket");
    expect(screen.getByRole("button", { name: "Save Action" })).toBeTruthy();

    vi.mocked(api.updateTicketAction).mockResolvedValue(
      staffAction({ id: 12, description: "Edited on a cancelled Ticket", version: 2 }),
    );
    await userEvent.clear(desc);
    await userEvent.type(desc, "Edited on a cancelled Ticket");
    await userEvent.click(screen.getByRole("button", { name: "Save Action" }));
    await waitFor(() => expect(api.updateTicketAction).toHaveBeenCalledTimes(1));
    expect(api.updateTicketAction).toHaveBeenCalledWith(
      TICKET,
      12,
      expect.objectContaining({ description: "Edited on a cancelled Ticket", expectedVersion: 1 }),
    );
  });
});

// ---------------------------------------------------------------------------
// Independent statuses on one Ticket (AC-06)
// ---------------------------------------------------------------------------

describe("UI-ACT-01 — Independent statuses on one Ticket (AC-06)", () => {
  it("AC-06 — completing Action A requires Result while cancelling Action B does not", async () => {
    const a = staffAction({ id: 1, description: "Action A" });
    const b = staffAction({ id: 2, description: "Action B" });
    vi.mocked(api.fetchStaffActions).mockResolvedValue({
      data: [a, b],
      pagination: { page: 1, pageSize: 10, totalItems: 2, totalPages: 1 },
    });
    vi.mocked(api.updateTicketAction).mockResolvedValue(
      staffAction({ id: 2, description: "Action B", status: "CANCELLED", version: 2 }),
    );
    render(<StaffActionsTaken ticketNumber={TICKET} ticketStatus="OPEN" />);
    await screen.findByText("Action A");

    // A: complete with a blank Result → client blocks.
    await userEvent.click(screen.getAllByRole("button", { name: "Edit Action" })[0]);
    await screen.findByRole("heading", { level: 3, name: "Edit Action" });
    await userEvent.click(screen.getByLabelText("Completed"));
    await userEvent.click(screen.getByRole("button", { name: "Save Action" }));
    expect(await screen.findByText("Result is required to complete an Action.")).toBeTruthy();
    expect(api.updateTicketAction).not.toHaveBeenCalled();

    // Back to the list, then B: cancel with a blank Result → succeeds.
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await userEvent.click(screen.getAllByRole("button", { name: "Edit Action" })[1]);
    await screen.findByRole("heading", { level: 3, name: "Edit Action" });
    await userEvent.click(screen.getByLabelText("Cancelled"));
    await userEvent.click(screen.getByRole("button", { name: "Save Action" }));

    await waitFor(() => expect(api.updateTicketAction).toHaveBeenCalledTimes(1));
    expect(api.updateTicketAction).toHaveBeenCalledWith(
      TICKET,
      2,
      expect.objectContaining({ status: "CANCELLED", result: null, expectedVersion: 1 }),
    );
    // The successful edit refreshes the current page.
    await waitFor(() => expect(api.fetchStaffActions).toHaveBeenCalledTimes(2));
  });
});

// ---------------------------------------------------------------------------
// Safe rendering and accessibility (AC-07, AC-21; FR-18)
// ---------------------------------------------------------------------------

describe("UI-ACT-01 — Safe rendering and accessibility (AC-07, AC-21, FR-18)", () => {
  it("AC-21 — a script payload in a description renders as literal text, never as markup", async () => {
    const payload = '<script>alert("xss")</script>';
    vi.mocked(api.fetchStaffActions).mockResolvedValue({
      data: [staffAction({ id: 1, description: payload })],
      pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
    });
    const { container } = render(<StaffActionsTaken ticketNumber={TICKET} ticketStatus="OPEN" />);

    expect(await screen.findByText(payload)).toBeTruthy();
    expect(container.querySelector("script")).toBeNull();
  });

  it("AC-21 — labels, required markers, described-by errors, and the conditional note are wired up", async () => {
    const { container } = render(
      <ActionForm ticketNumber={TICKET} action={null} onSaved={vi.fn()} onCancel={vi.fn()} />,
    );

    // Every field is reachable by its label; no file input exists.
    const desc = screen.getByLabelText(/Description/) as HTMLTextAreaElement;
    expect(desc.id).toBe("action-description");
    expect(screen.getByLabelText("Result")).toBeTruthy();
    expect(screen.getByLabelText("Follow-up Required")).toBeTruthy();
    expect(screen.getByLabelText(/Attachment Notes/)).toBeTruthy();
    expect(screen.getByLabelText("Assignee")).toBeTruthy();
    expect(container.querySelector('input[type="file"]')).toBeNull();

    // Required fields carry aria-required; the conditional note appears and is required.
    expect(desc.getAttribute("aria-required")).toBe("true");
    await userEvent.click(screen.getByLabelText("Follow-up Required"));
    const note = screen.getByLabelText(/Follow-up Note/) as HTMLTextAreaElement;
    expect(note.getAttribute("aria-required")).toBe("true");

    // Validation errors are linked from the control via aria-describedby:
    // the referenced id must resolve to the rendered role="alert" error.
    await userEvent.click(screen.getByRole("button", { name: "Record Action" }));
    await screen.findByText("Description is required.");
    const errorEl = document.getElementById("action-description-error");
    expect(errorEl).toBeTruthy();
    expect(errorEl?.getAttribute("role")).toBe("alert");
    const describedBy = desc.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy as string)).toBe(errorEl);
    expect(api.createTicketAction).not.toHaveBeenCalled();
  });
});
