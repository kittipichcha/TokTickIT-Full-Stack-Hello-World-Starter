import { fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StaffTicketDetail from "../StaffTicketDetail";
import TicketStatusHistory from "../TicketStatusHistory";
import App from "../App";
import * as api from "../api";
import { TEST_USER, TEST_STAFF_USER } from "../lab-02-tests/helpers/user";
import type { AuthUser } from "../api-client";

vi.mock("../api");

const ticketNumber = "TKT-2026-000001";
const adminUser: AuthUser = { id: 3, name: "Admin", email: "admin@example.com", role: "ADMINISTRATOR", mustChangePassword: false };
const owners = [{ id: 5, name: "Alice", role: "IT_STAFF" }, { id: 6, name: "Bob", role: "IT_STAFF" }];

function detail(overrides: Partial<api.StaffTicketDetail> = {}): api.StaffTicketDetail {
  return {
    id: 1, ticketNumber, summary: "Printer failure", description: "Offline", currentStatus: "IN_PROGRESS",
    requestedPriority: "MEDIUM", itPriority: "MEDIUM", ticketOwnerId: 5, requesterId: 8,
    requesterName: "Requester", requesterIsActive: true, categoryId: 1, categoryName: "Hardware",
    relatedSystemId: 1, relatedSystemName: "Office", appearsResolved: false, version: 4,
    createdAt: "2026-09-10T00:00:00Z", updatedAt: "2026-09-10T00:00:00Z",
    publicComments: [], internalNotes: [], attachments: [], ...overrides,
  };
}

function history(totalItems: number, page: number): api.TicketStatusHistoryResponse {
  const start = (page - 1) * 10;
  const rows = Array.from({ length: Math.max(0, Math.min(10, totalItems - start)) }, (_, i) => {
    const n = start + i + 1;
    return {
      id: n, ticketNumber, changedBy: { id: 5, name: `Staff ${n}` }, changedAt: `2026-09-${String(n).padStart(2, "0")}T10:00:00.000Z`,
      fromStatus: "OPEN", toStatus: "IN_PROGRESS", versionBefore: n, versionAfter: n + 1,
    };
  });
  return { data: rows, pagination: { page, pageSize: 10, totalItems, totalPages: Math.ceil(totalItems / 10) } };
}

const emptyActions: api.ActionListResponse<api.StaffActionDto> = {
  data: [], pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 },
};

function renderDetail() {
  return render(<StaffTicketDetail ticketNumber={ticketNumber} currentUserId={5} onBack={() => {}} />);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe("UI-WF-01/02 — versioned Ticket workflow", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(api.fetchAssignableOwners).mockResolvedValue(owners);
    vi.mocked(api.fetchStaffActions).mockResolvedValue(emptyActions);
    vi.mocked(api.fetchTicketStatusHistory).mockResolvedValue(history(0, 1));
  });
  afterEach(() => cleanup());

  it("offers Reopened to In Progress and explains ownership and Pending Action gates", async () => {
    vi.mocked(api.fetchStaffTicketDetail).mockResolvedValue(detail({ currentStatus: "REOPENED", ticketOwnerId: 5 }));
    renderDetail();
    await screen.findByText(ticketNumber);
    expect((screen.getByRole("button", { name: "In Progress" }) as HTMLButtonElement).disabled).toBe(false);
    cleanup();
    vi.mocked(api.fetchStaffTicketDetail).mockResolvedValue(detail({ currentStatus: "IN_PROGRESS", ticketOwnerId: null }));
    renderDetail();
    await screen.findByText(ticketNumber);
    expect((screen.getByRole("button", { name: "Resolved" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Claim or assign this ticket/i)).toBeTruthy();
    expect(screen.getByText(/Pending Action blocks resolution/i)).toBeTruthy();
  });

  it("sends latest versions for owner, priority, and status and applies returned snapshots", async () => {
    const user = userEvent.setup();
    vi.mocked(api.fetchStaffTicketDetail)
      .mockResolvedValueOnce(detail({ version: 4 }))
      .mockResolvedValueOnce(detail({ ticketOwnerId: 6, version: 5 }))
      .mockResolvedValueOnce(detail({ ticketOwnerId: 6, itPriority: "HIGH", version: 6 }))
      .mockResolvedValueOnce(detail({ ticketOwnerId: 6, itPriority: "HIGH", currentStatus: "WAITING_FOR_REQUESTER", version: 7 }));
    vi.mocked(api.setTicketOwner).mockResolvedValue({ ticketOwnerId: 6, version: 5 });
    vi.mocked(api.setItPriority).mockResolvedValue({ itPriority: "HIGH", version: 6 });
    vi.mocked(api.applyStatusTransition).mockResolvedValue({ currentStatus: "WAITING_FOR_REQUESTER", version: 7 });
    renderDetail();
    await screen.findByText(ticketNumber);

    await user.selectOptions(screen.getByLabelText("Ticket Owner"), "6");
    await user.click(screen.getByRole("button", { name: "Reassign" }));
    await waitFor(() => expect(api.setTicketOwner).toHaveBeenCalledWith(ticketNumber, 6, 4));
    await user.selectOptions(screen.getByLabelText("IT Priority"), "HIGH");
    await user.click(screen.getByRole("button", { name: "Save priority" }));
    await waitFor(() => expect(api.setItPriority).toHaveBeenCalledWith(ticketNumber, "HIGH", 5));
    await user.click(screen.getByRole("button", { name: "Waiting for Requester" }));
    await waitFor(() => expect(api.applyStatusTransition).toHaveBeenCalledWith(ticketNumber, "WAITING_FOR_REQUESTER", 6));
    expect(screen.getByText("WAITING_FOR_REQUESTER")).toBeTruthy();
  });

  it("keeps owner and priority drafts after conflict, refreshes once, and never replays", async () => {
    const user = userEvent.setup();
    vi.mocked(api.fetchStaffTicketDetail)
      .mockResolvedValueOnce(detail({ version: 4 }))
      .mockResolvedValueOnce(detail({ version: 5, ticketOwnerId: 5 }))
      .mockResolvedValueOnce(detail({ version: 6, ticketOwnerId: 5 }));
    const conflict = Object.assign(new Error("Stale"), { status: 409 });
    vi.mocked(api.setTicketOwner).mockRejectedValueOnce(conflict).mockResolvedValue({ ticketOwnerId: 6, version: 6 });
    vi.mocked(api.setItPriority).mockRejectedValueOnce(conflict);
    renderDetail();
    await screen.findByText(ticketNumber);

    await user.selectOptions(screen.getByLabelText("Ticket Owner"), "6");
    await user.click(screen.getByRole("button", { name: "Reassign" }));
    await screen.findByText(/Ticket changed since it was loaded/i);
    await waitFor(() => expect(api.fetchStaffTicketDetail).toHaveBeenCalledTimes(2));
    expect(api.setTicketOwner).toHaveBeenCalledTimes(1);
    expect((screen.getByLabelText("Ticket Owner") as HTMLSelectElement).value).toBe("6");

    await user.selectOptions(screen.getByLabelText("IT Priority"), "HIGH");
    await user.click(screen.getByRole("button", { name: "Save priority" }));
    await waitFor(() => expect(api.fetchStaffTicketDetail).toHaveBeenCalledTimes(3));
    expect(api.setItPriority).toHaveBeenCalledWith(ticketNumber, "HIGH", 5);
    expect(api.setItPriority).toHaveBeenCalledTimes(1);
    expect(api.setTicketOwner).toHaveBeenCalledTimes(1);
    expect((screen.getByLabelText("IT Priority") as HTMLSelectElement).value).toBe("HIGH");
  });

  it("blocks workflow after a failed conflict refresh until explicit refresh, then uses new version", async () => {
    const user = userEvent.setup();
    vi.mocked(api.fetchStaffTicketDetail)
      .mockResolvedValueOnce(detail({ version: 4 }))
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(detail({ version: 8 }));
    vi.mocked(api.applyStatusTransition).mockRejectedValueOnce(Object.assign(new Error("Stale"), { status: 409 }))
      .mockResolvedValue({ currentStatus: "WAITING_FOR_REQUESTER", version: 9 });
    renderDetail();
    await screen.findByText(ticketNumber);
    await user.click(screen.getByRole("button", { name: "Waiting for Requester" }));
    await screen.findByRole("button", { name: "Refresh ticket" });
    expect((screen.getByRole("button", { name: "Waiting for Requester" }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole("button", { name: "Refresh ticket" }));
    await screen.findByText(/Ticket refreshed/i);
    await user.click(screen.getByRole("button", { name: "Waiting for Requester" }));
    await waitFor(() => expect(api.applyStatusTransition).toHaveBeenLastCalledWith(ticketNumber, "WAITING_FOR_REQUESTER", 8));
  });

  it("cancels confirmation and Escape without a request, then confirms with current version", async () => {
    const user = userEvent.setup();
    vi.mocked(api.fetchStaffTicketDetail).mockResolvedValue(detail());
    vi.mocked(api.applyStatusTransition).mockResolvedValue({ currentStatus: "RESOLVED", version: 5 });
    renderDetail();
    await screen.findByText(ticketNumber);
    await user.click(screen.getByRole("button", { name: "Resolved" }));
    await user.keyboard("{Escape}");
    expect(api.applyStatusTransition).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Resolved" }));
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(api.applyStatusTransition).toHaveBeenCalledWith(ticketNumber, "RESOLVED", 4));
  });

  it("announces committed snapshots before failed refresh and uses each returned version on the next write", async () => {
    const user = userEvent.setup();
    vi.mocked(api.fetchStaffTicketDetail)
      .mockResolvedValueOnce(detail({ version: 4 }))
      .mockRejectedValueOnce(new Error("offline"))
      .mockRejectedValueOnce(new Error("offline"))
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(detail({ ticketOwnerId: 6, itPriority: "HIGH", currentStatus: "WAITING_FOR_REQUESTER", version: 8 }));
    vi.mocked(api.setTicketOwner).mockResolvedValue({ ticketOwnerId: 6, version: 5 });
    vi.mocked(api.setItPriority).mockResolvedValue({ itPriority: "HIGH", version: 6 });
    vi.mocked(api.applyStatusTransition).mockResolvedValue({ currentStatus: "WAITING_FOR_REQUESTER", version: 7 });
    renderDetail();
    await screen.findByText(ticketNumber);

    await user.selectOptions(screen.getByLabelText("Ticket Owner"), "6");
    await user.click(screen.getByRole("button", { name: "Reassign" }));
    expect((await screen.findByRole("status")).textContent).toContain("Owner updated successfully");
    expect((await screen.findByRole("alert")).textContent).toContain("refresh failed");
    await user.selectOptions(screen.getByLabelText("IT Priority"), "HIGH");
    await user.click(screen.getByRole("button", { name: "Save priority" }));
    expect((await screen.findByRole("status")).textContent).toContain("IT Priority updated successfully");
    expect(api.setItPriority).toHaveBeenCalledWith(ticketNumber, "HIGH", 5);
    await user.click(screen.getByRole("button", { name: "Waiting for Requester" }));
    expect((await screen.findByRole("status")).textContent).toContain("Status updated successfully");
    expect(api.applyStatusTransition).toHaveBeenCalledWith(ticketNumber, "WAITING_FOR_REQUESTER", 6);
    expect(screen.getByText("WAITING_FOR_REQUESTER")).toBeTruthy();
    vi.mocked(api.setTicketOwner).mockResolvedValueOnce({ ticketOwnerId: 6, version: 8 });
    await user.selectOptions(screen.getByLabelText("Ticket Owner"), "6");
    await user.click(screen.getByRole("button", { name: "Reassign" }));
    await waitFor(() => expect(api.setTicketOwner).toHaveBeenLastCalledWith(ticketNumber, 6, 7));
  });

  it("keeps a superseded 409 read blocked after a concurrent note failure", async () => {
    const user = userEvent.setup();
    const conflictRead = deferred<api.StaffTicketDetail>();
    vi.mocked(api.fetchStaffTicketDetail).mockResolvedValueOnce(detail({ version: 4 })).mockReturnValueOnce(conflictRead.promise).mockResolvedValueOnce(detail({ version: 8 }));
    vi.mocked(api.applyStatusTransition).mockRejectedValue(Object.assign(new Error("Ticket is stale"), { status: 409 }));
    vi.mocked(api.postInternalNote).mockRejectedValue(new Error("Note unavailable"));
    renderDetail();
    await screen.findByText(ticketNumber);
    await user.click(screen.getByRole("button", { name: "Waiting for Requester" }));
    await screen.findByRole("textbox", { name: "Add an internal note" });
    await user.type(screen.getByRole("textbox", { name: "Add an internal note" }), "retry note");
    await user.click(screen.getByRole("button", { name: "Post Note" }));
    await screen.findByText("Note unavailable");
    await act(async () => {
      conflictRead.resolve(detail({ version: 6 }));
      await conflictRead.promise;
    });
    await waitFor(() => expect((screen.getByRole("button", { name: "Waiting for Requester" }) as HTMLButtonElement).disabled).toBe(true));
    await user.click(screen.getByRole("button", { name: "Refresh ticket" }));
    await screen.findByText(/Ticket refreshed/i);
    expect((screen.getByRole("button", { name: "Waiting for Requester" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("does not let an older comment refresh overwrite a successful workflow version", async () => {
    const user = userEvent.setup();
    const commentRead = deferred<api.StaffTicketDetail>();
    vi.mocked(api.fetchStaffTicketDetail)
      .mockResolvedValueOnce(detail({ version: 4 }))
      .mockReturnValueOnce(commentRead.promise)
      .mockRejectedValueOnce(new Error("refresh offline"));
    vi.mocked(api.postTicketComment).mockResolvedValue({ id: 1, content: "comment", authorId: 5, createdAt: "2026-09-10T00:00:00Z" });
    vi.mocked(api.setItPriority).mockResolvedValue({ itPriority: "HIGH", version: 5 });
    vi.mocked(api.applyStatusTransition).mockResolvedValue({ currentStatus: "WAITING_FOR_REQUESTER", version: 6 });
    renderDetail();
    await screen.findByText(ticketNumber);
    await user.type(screen.getByRole("textbox", { name: "Add a comment" }), "comment");
    await user.click(screen.getByRole("button", { name: "Post Comment" }));
    await waitFor(() => expect(api.fetchStaffTicketDetail).toHaveBeenCalledTimes(2));
    await user.selectOptions(screen.getByLabelText("IT Priority"), "HIGH");
    await user.click(screen.getByRole("button", { name: "Save priority" }));
    await screen.findByText(/refresh failed/i);
    await act(async () => {
      commentRead.resolve(detail({ version: 4 }));
      await commentRead.promise;
    });
    await user.click(screen.getByRole("button", { name: "Waiting for Requester" }));
    await waitFor(() => expect(api.applyStatusTransition).toHaveBeenCalledWith(ticketNumber, "WAITING_FOR_REQUESTER", 5));
  });
});

describe("UI-WF-HISTORY-01 — Ticket status history", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(api.fetchAssignableOwners).mockResolvedValue(owners);
    vi.mocked(api.fetchStaffActions).mockResolvedValue(emptyActions);
    vi.mocked(api.fetchCategories).mockResolvedValue([{ id: 1, name: "Hardware" }]);
    vi.mocked(api.fetchRequesterActions).mockResolvedValue(emptyActions as api.ActionListResponse<api.RequesterActionDto>);
    vi.mocked(api.fetchStaffQueue).mockResolvedValue({ data: [{ id: 1, ticketNumber, summary: "Printer failure", categoryName: "Hardware", currentStatus: "IN_PROGRESS", requestedPriority: "MEDIUM", itPriority: "MEDIUM", ticketOwnerId: 5, requesterId: 8, createdAt: "2026-09-10T00:00:00Z", updatedAt: "2026-09-10T00:00:00Z" }], pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1, unfilteredTotalItems: 1 } });
    vi.mocked(api.fetchMyTickets).mockResolvedValue({ data: [], pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0, unfilteredTotalItems: 0 } });
    vi.mocked(api.fetchTicketDetail).mockResolvedValue({ id: 1, ticketNumber, requesterId: TEST_USER.id, requesterName: TEST_USER.name, requesterIsActive: true, categoryId: 1, categoryName: "Hardware", relatedSystemId: 1, relatedSystemName: "Office", summary: "Printer failure", description: "Offline", requestedPriority: "MEDIUM", itPriority: "MEDIUM", ticketOwnerId: 5, currentStatus: "IN_PROGRESS", createdAt: "2026-09-10T00:00:00Z", updatedAt: "2026-09-10T00:00:00Z", appearsResolved: false, attachments: [], publicComments: [] });
  });
  afterEach(() => cleanup());

  it("loads lazily and reaches all 21 rows in three pages", async () => {
    const user = userEvent.setup();
    vi.mocked(api.fetchStaffTicketDetail).mockResolvedValue(detail());
    vi.mocked(api.fetchTicketStatusHistory).mockImplementation(async (_ticket, page = 1) => history(21, page));
    renderDetail();
    await screen.findByText(ticketNumber);
    expect(api.fetchTicketStatusHistory).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "View status history" }));
    expect(await screen.findByText("Page 1 of 3")).toBeTruthy();
    expect(api.fetchTicketStatusHistory).toHaveBeenLastCalledWith(ticketNumber, 1, 10);
    expect((screen.getByRole("button", { name: "Previous" }) as HTMLButtonElement).disabled).toBe(true);
    const expectPage = (first: number, count: number) => {
      const rows = screen.getAllByRole("listitem");
      expect(rows).toHaveLength(count);
      rows.forEach((row, index) => {
        const n = first + index;
        expect(within(row).getByText("Open → In Progress")).toBeTruthy();
        expect(within(row).getByText(`Changed by Staff ${n}`)).toBeTruthy();
        expect(within(row).getByText(`Version ${n} → ${n + 1}`)).toBeTruthy();
        expect((row.querySelector("time") as HTMLTimeElement).dateTime).toBe(`2026-09-${String(n).padStart(2, "0")}T10:00:00.000Z`);
      });
    };
    expectPage(1, 10);
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Page 2 of 3")).toBeTruthy();
    expectPage(11, 10);
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Page 3 of 3")).toBeTruthy();
    expectPage(21, 1);
    expect((screen.getByRole("button", { name: "Next" }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole("button", { name: "Previous" }));
    expect(await screen.findByText("Page 2 of 3")).toBeTruthy();
  });

  it("preserves keyboard focus through delayed forward, backward, and boundary page reads", async () => {
    const user = userEvent.setup();
    const reads = Array.from({ length: 5 }, () => deferred<api.TicketStatusHistoryResponse>());
    vi.mocked(api.fetchTicketStatusHistory).mockResolvedValueOnce(history(21, 1));
    reads.forEach((read) => vi.mocked(api.fetchTicketStatusHistory).mockReturnValueOnce(read.promise));
    render(<TicketStatusHistory ticketNumber={ticketNumber} ticketVersion={4} />);
    await user.click(screen.getByRole("button", { name: "View status history" }));
    await screen.findByText("Page 1 of 3");
    const next = screen.getByRole("button", { name: "Next" });
    next.focus();
    await user.keyboard("{Enter}{Enter}");
    expect(document.activeElement).toBe(next);
    expect(next.getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("navigation", { name: "Status history pages" }).closest("[aria-busy]")?.getAttribute("aria-busy")).toBe("true");
    expect(screen.getByText("Page 1 of 3")).toBeTruthy();
    expect(screen.getByText("Changed by Staff 1")).toBeTruthy();
    expect(api.fetchTicketStatusHistory).toHaveBeenCalledTimes(2);
    await act(async () => { reads[0]!.resolve(history(21, 2)); });
    expect(document.activeElement).toBe(next);
    expect(next.getAttribute("aria-disabled")).toBe("false");
    const previous = screen.getByRole("button", { name: "Previous" });
    previous.focus();
    await user.keyboard("{Enter}");
    expect(document.activeElement).toBe(previous);
    await act(async () => { reads[1]!.resolve(history(21, 1)); });
    expect(document.activeElement).toBe(screen.getByRole("status", { name: "Status history page" }));
    await user.tab();
    expect(document.activeElement).toBe(next);
    await user.keyboard("{Enter}");
    await act(async () => { reads[2]!.resolve(history(21, 2)); });
    await user.keyboard("{Enter}");
    expect(document.activeElement).toBe(next);
    await act(async () => { reads[3]!.resolve(history(21, 3)); });
    expect(document.activeElement).toBe(screen.getByRole("status", { name: "Status history page" }));
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(previous);
    await user.keyboard("{Enter}");
    await user.tab({ shift: true });
    const toggle = screen.getByRole("button", { name: "Hide status history" });
    expect(document.activeElement).toBe(toggle);
    await act(async () => { reads[4]!.resolve(history(21, 2)); });
    expect(document.activeElement).toBe(toggle);
  });

  it("keeps the displayed page and keyboard recovery after a failed page read", async () => {
    const user = userEvent.setup();
    const failed = deferred<api.TicketStatusHistoryResponse>();
    const retry = deferred<api.TicketStatusHistoryResponse>();
    vi.mocked(api.fetchTicketStatusHistory).mockResolvedValueOnce(history(21, 1)).mockReturnValueOnce(failed.promise).mockReturnValueOnce(retry.promise);
    render(<TicketStatusHistory ticketNumber={ticketNumber} ticketVersion={4} />);
    await user.click(screen.getByRole("button", { name: "View status history" }));
    await screen.findByText("Page 1 of 3");
    const next = screen.getByRole("button", { name: "Next" });
    next.focus();
    await user.keyboard("{Enter}");
    await act(async () => { failed.reject(new Error("offline")); });
    expect(screen.getByText("Page 1 of 3")).toBeTruthy();
    const retryButton = screen.getByRole("button", { name: "Retry" });
    expect(document.activeElement).toBe(retryButton);
    await user.keyboard("{Enter}{Enter}");
    expect(document.activeElement).toBe(retryButton);
    expect(retryButton.getAttribute("aria-disabled")).toBe("true");
    expect(api.fetchTicketStatusHistory).toHaveBeenCalledTimes(3);
    await act(async () => { retry.resolve(history(21, 2)); });
    expect(document.activeElement).toBe(screen.getByRole("status", { name: "Status history page" }));
    await user.tab();
    expect(document.activeElement).toBe(next);
  });

  it.each([0, 1])("returns keyboard focus to the history toggle when Retry loads %s rows", async (totalItems) => {
    const user = userEvent.setup();
    const retry = deferred<api.TicketStatusHistoryResponse>();
    vi.mocked(api.fetchTicketStatusHistory).mockRejectedValueOnce(new Error("offline")).mockReturnValueOnce(retry.promise);
    render(<TicketStatusHistory ticketNumber={ticketNumber} ticketVersion={4} />);
    await user.click(screen.getByRole("button", { name: "View status history" }));
    const retryButton = await screen.findByRole("button", { name: "Retry" });
    await user.tab();
    expect(document.activeElement).toBe(retryButton);
    await user.keyboard("{Enter}{Enter}");
    expect(document.activeElement).toBe(retryButton);
    expect(api.fetchTicketStatusHistory).toHaveBeenCalledTimes(2);
    await act(async () => { retry.resolve(history(totalItems, 1)); });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Hide status history" }));
    expect(screen.queryByRole("navigation", { name: "Status history pages" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
    if (totalItems === 0) expect(screen.getByText("No status history.")).toBeTruthy();
    else expect(screen.getByText("Changed by Staff 1")).toBeTruthy();
  });

  it("hides pagination for zero and one page", async () => {
    const user = userEvent.setup();
    vi.mocked(api.fetchTicketStatusHistory).mockResolvedValue(history(0, 1));
    const view = render(<TicketStatusHistory ticketNumber={ticketNumber} ticketVersion={4} />);
    await user.click(screen.getByRole("button", { name: "View status history" }));
    expect(await screen.findByText("No status history.")).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: "Status history pages" })).toBeNull();
    vi.mocked(api.fetchTicketStatusHistory).mockResolvedValue(history(1, 1));
    view.rerender(<TicketStatusHistory ticketNumber={ticketNumber} ticketVersion={5} />);
    expect(await screen.findByText("Changed by Staff 1")).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.queryByRole("navigation", { name: "Status history pages" })).toBeNull();
    view.unmount();
  });

  it.each([
    [401, "Sign in to view status history."], [403, "You do not have permission to view status history."], [404, "Ticket not found."], [500, "Unable to load status history."],
  ])("distinguishes status-history HTTP %s and offers retry", async (status, message) => {
    const user = userEvent.setup();
    vi.mocked(api.fetchStaffTicketDetail).mockResolvedValue(detail());
    vi.mocked(api.fetchTicketStatusHistory).mockRejectedValueOnce(Object.assign(new Error("failure"), { status }))
      .mockResolvedValue(history(0, 1));
    renderDetail();
    await screen.findByText(ticketNumber);
    await user.click(screen.getByRole("button", { name: "View status history" }));
    expect(await screen.findByText(message)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(api.fetchTicketStatusHistory).toHaveBeenCalledTimes(2));
  });

  it("shows pagination when history grows from ten to eleven rows", async () => {
    const user = userEvent.setup();
    let totalItems = 10;
    vi.mocked(api.fetchTicketStatusHistory).mockImplementation(async (_ticket, page = 1) => history(totalItems, page));
    const view = render(<TicketStatusHistory ticketNumber={ticketNumber} ticketVersion={4} />);
    await user.click(screen.getByRole("button", { name: "View status history" }));
    await screen.findByText("Changed by Staff 1");
    expect(screen.getAllByRole("listitem")).toHaveLength(10);
    expect(screen.queryByRole("navigation", { name: "Status history pages" })).toBeNull();
    const callsBeforeEleventhRow = vi.mocked(api.fetchTicketStatusHistory).mock.calls.length;
    totalItems = 11;
    view.rerender(<TicketStatusHistory ticketNumber={ticketNumber} ticketVersion={5} />);
    await waitFor(() => expect(api.fetchTicketStatusHistory).toHaveBeenCalledTimes(callsBeforeEleventhRow + 1));
    expect(await screen.findByText("Page 1 of 2")).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Status history pages" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Changed by Staff 11")).toBeTruthy();
    view.unmount();
  });

  it("invalidates history by version, lazily reloads while closed, resets on ticket change, and retries failed pages", async () => {
    const user = userEvent.setup();
    vi.mocked(api.fetchTicketStatusHistory).mockImplementation(async (_ticket, page = 1) => history(21, page));
    const view = render(<TicketStatusHistory ticketNumber={ticketNumber} ticketVersion={4} />);
    await user.click(screen.getByRole("button", { name: "View status history" }));
    await screen.findByText("Page 1 of 3");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Page 2 of 3");
    const beforeVersionReload = vi.mocked(api.fetchTicketStatusHistory).mock.calls.length;
    view.rerender(<TicketStatusHistory ticketNumber={ticketNumber} ticketVersion={5} />);
    await waitFor(() => expect(api.fetchTicketStatusHistory).toHaveBeenCalledTimes(beforeVersionReload + 1));
    expect(api.fetchTicketStatusHistory).toHaveBeenLastCalledWith(ticketNumber, 2, 10);
    expect(await screen.findByText("Changed by Staff 11")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Hide status history" }));
    const callsWhileClosed = vi.mocked(api.fetchTicketStatusHistory).mock.calls.length;
    view.rerender(<TicketStatusHistory ticketNumber={ticketNumber} ticketVersion={6} />);
    expect(api.fetchTicketStatusHistory).toHaveBeenCalledTimes(callsWhileClosed);
    await user.click(screen.getByRole("button", { name: "View status history" }));
    await waitFor(() => expect(api.fetchTicketStatusHistory).toHaveBeenCalledTimes(callsWhileClosed + 1));
    expect(api.fetchTicketStatusHistory).toHaveBeenLastCalledWith(ticketNumber, 1, 10);
    expect(await screen.findByText("Changed by Staff 1")).toBeTruthy();
    view.rerender(<TicketStatusHistory ticketNumber="TKT-2026-000002" ticketVersion={1} />);
    expect(await screen.findByRole("button", { name: "View status history" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "View status history" }));
    await waitFor(() => expect(api.fetchTicketStatusHistory).toHaveBeenLastCalledWith("TKT-2026-000002", 1, 10));

    view.unmount();
    let failedPageTwo = false;
    vi.mocked(api.fetchTicketStatusHistory).mockImplementation(async (_ticket, page = 1) => {
      if (page === 2 && !failedPageTwo) { failedPageTwo = true; throw new Error("offline"); }
      return history(21, page);
    });
    const retryView = render(<TicketStatusHistory ticketNumber={ticketNumber} ticketVersion={4} />);
    await user.click(screen.getByRole("button", { name: "View status history" }));
    await screen.findByText("Page 1 of 3");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByRole("button", { name: "Retry" });
    const callsBeforeRetry = vi.mocked(api.fetchTicketStatusHistory).mock.calls.length;
    await user.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(api.fetchTicketStatusHistory).toHaveBeenCalledTimes(callsBeforeRetry + 1));
    expect(api.fetchTicketStatusHistory).toHaveBeenLastCalledWith(ticketNumber, 2, 10);
    expect(await screen.findByText("Page 2 of 3")).toBeTruthy();
    expect(await screen.findByText("Changed by Staff 11")).toBeTruthy();
    retryView.unmount();
  });

  it.each([{ user: TEST_STAFF_USER }, { user: adminUser }])("App Staff/Admin can open history; Requester cannot", async ({ user: staffUser }) => {
    const user = userEvent.setup();
    vi.mocked(api.fetchStaffTicketDetail).mockResolvedValue(detail());
    vi.mocked(api.fetchTicketStatusHistory).mockResolvedValue(history(1, 1));
    render(<App user={staffUser} />);
    // Issue #54: enter the existing role list from its dashboard landing.
    fireEvent.click(screen.getByRole("link", { name: "Ticket Queue" }));
    const queue = await screen.findByRole("grid");
    await user.click(within(queue).getByRole("button", { name: /Open Detail/i }));
    await screen.findByRole("heading", { name: new RegExp(ticketNumber) });
    await user.click(screen.getByRole("button", { name: "View status history" }));
    await screen.findByText("Changed by Staff 1");
    expect(api.fetchTicketStatusHistory).toHaveBeenCalledWith(ticketNumber, 1, 10);
    cleanup();
    vi.mocked(api.fetchTicketStatusHistory).mockClear();

    vi.mocked(api.fetchMyTickets).mockResolvedValue({ data: [{ id: 1, ticketNumber, categoryId: 1, categoryName: "Hardware", summary: "Printer failure", requestedPriority: "MEDIUM", itPriority: "MEDIUM", currentStatus: "IN_PROGRESS", createdAt: "2026-09-10T00:00:00Z", updatedAt: "2026-09-10T00:00:00Z" }], pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1, unfilteredTotalItems: 1 } });
    render(<App user={TEST_USER} />);
    // Issue #54: enter the existing role list from its dashboard landing.
    fireEvent.click(screen.getByRole("link", { name: "My Tickets" }));
    const requesterLinks = await screen.findAllByRole("link", { name: ticketNumber });
    await user.click(requesterLinks[0]!);
    await screen.findByRole("heading", { name: new RegExp(ticketNumber) });
    expect(screen.queryByText(/status history/i)).toBeNull();
    expect(api.fetchTicketStatusHistory).not.toHaveBeenCalled();
  });
});
