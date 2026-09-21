/**
 * Frozen Test-DD file: `client/src/lab-03-tests/StaffTicketDetail.test.tsx`
 *
 * Owned by Issue #38. Frozen rows executed here:
 *   - UI-STAFF-01  Staff Ticket Detail (AC-11–14)
 *   - UI-STAFF-02  Status change to Resolved/Closed/Cancelled confirmation (AC-13)
 *
 * Supplementary (never a tests.md row): safe-render assertion (BR-24) — HTML/
 * script content renders as text, never as markup.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StaffTicketDetail from "../StaffTicketDetail";
import * as api from "../api";

vi.mock("../api");

function detail(overrides: Partial<api.StaffTicketDetail> = {}): api.StaffTicketDetail {
  return {
    id: 1,
    ticketNumber: "TKT-2026-000001",
    summary: "Printer not working",
    description: "The printer is offline.",
    currentStatus: "NEW",
    requestedPriority: "MEDIUM",
    itPriority: "MEDIUM",
    ticketOwnerId: null,
    requesterId: 7,
    requesterName: "Ada Lovelace",
    requesterIsActive: true,
    categoryId: 1,
    categoryName: "Hardware",
    relatedSystemId: 1,
    relatedSystemName: "Office",
    appearsResolved: false,
    createdAt: "2026-09-10T00:00:00Z",
    updatedAt: "2026-09-10T00:00:00Z",
    publicComments: [],
    internalNotes: [],
    ...overrides,
  };
}

describe("UI-STAFF-01 — Staff Ticket Detail (AC-11–14)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => cleanup());

  it("renders ticket info, comments, and notes sections", async () => {
    vi.mocked(api.fetchStaffTicketDetail).mockResolvedValue(detail());
    render(<StaffTicketDetail ticketNumber="TKT-2026-000001" currentUserId={5} onBack={() => {}} />);

    expect(await screen.findByText("TKT-2026-000001")).toBeTruthy();
    expect(screen.getByText("Public Comments")).toBeTruthy();
    expect(screen.getByText("Internal Notes")).toBeTruthy();
    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
  });

  it("renders only the permitted transition buttons for the current status", async () => {
    // NEW permits only OPEN (plus CANCELLED via the any-non-Cancelled rule).
    vi.mocked(api.fetchStaffTicketDetail).mockResolvedValue(detail({ currentStatus: "NEW" }));
    render(<StaffTicketDetail ticketNumber="TKT-2026-000001" currentUserId={5} onBack={() => {}} />);

    await screen.findByText("TKT-2026-000001");
    expect(screen.getByRole("button", { name: "Open" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancelled" })).toBeTruthy();
    // Forbidden targets must not render.
    expect(screen.queryByRole("button", { name: "Resolved" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Closed" })).toBeNull();
    expect(screen.queryByRole("button", { name: "In Progress" })).toBeNull();
  });

  it("renders no transition buttons for a terminal CANCELLED ticket", async () => {
    vi.mocked(api.fetchStaffTicketDetail).mockResolvedValue(detail({ currentStatus: "CANCELLED" }));
    render(<StaffTicketDetail ticketNumber="TKT-2026-000001" currentUserId={5} onBack={() => {}} />);

    await screen.findByText("TKT-2026-000001");
    expect(screen.getByText(/No permitted transitions/i)).toBeTruthy();
  });

  it("claims the ticket for the current user", async () => {
    vi.mocked(api.fetchStaffTicketDetail).mockResolvedValue(detail());
    vi.mocked(api.setTicketOwner).mockResolvedValue({ ticketOwnerId: 5 });
    render(<StaffTicketDetail ticketNumber="TKT-2026-000001" currentUserId={5} onBack={() => {}} />);

    await screen.findByText("TKT-2026-000001");
    await userEvent.click(screen.getByRole("button", { name: /Claim \/ Reassign to me/i }));
    await waitFor(() => expect(api.setTicketOwner).toHaveBeenCalledWith("TKT-2026-000001", 5));
  });

  it("sets the IT Priority", async () => {
    vi.mocked(api.fetchStaffTicketDetail).mockResolvedValue(detail());
    vi.mocked(api.setItPriority).mockResolvedValue({ itPriority: "HIGH" });
    render(<StaffTicketDetail ticketNumber="TKT-2026-000001" currentUserId={5} onBack={() => {}} />);

    await screen.findByText("TKT-2026-000001");
    await userEvent.selectOptions(screen.getByLabelText("IT Priority"), "HIGH");
    await waitFor(() => expect(api.setItPriority).toHaveBeenCalledWith("TKT-2026-000001", "HIGH"));
  });

  it("posts a public comment", async () => {
    vi.mocked(api.fetchStaffTicketDetail).mockResolvedValue(detail());
    vi.mocked(api.postTicketComment).mockResolvedValue({
      id: 1,
      content: "Looking into it.",
      authorId: 5,
      createdAt: "2026-09-10T00:00:00Z",
    });
    render(<StaffTicketDetail ticketNumber="TKT-2026-000001" currentUserId={5} onBack={() => {}} />);

    await screen.findByText("TKT-2026-000001");
    await userEvent.type(screen.getByLabelText("Add a comment"), "Looking into it.");
    await userEvent.click(screen.getByRole("button", { name: /Post Comment/i }));
    await waitFor(() =>
      expect(api.postTicketComment).toHaveBeenCalledWith("TKT-2026-000001", "Looking into it."),
    );
  });

  it("posts an internal note", async () => {
    vi.mocked(api.fetchStaffTicketDetail).mockResolvedValue(detail());
    vi.mocked(api.postInternalNote).mockResolvedValue({
      id: 1,
      content: "Internal only.",
      authorId: 5,
      createdAt: "2026-09-10T00:00:00Z",
    });
    render(<StaffTicketDetail ticketNumber="TKT-2026-000001" currentUserId={5} onBack={() => {}} />);

    await screen.findByText("TKT-2026-000001");
    await userEvent.type(screen.getByLabelText("Add an internal note"), "Internal only.");
    await userEvent.click(screen.getByRole("button", { name: /Post Note/i }));
    await waitFor(() =>
      expect(api.postInternalNote).toHaveBeenCalledWith("TKT-2026-000001", "Internal only."),
    );
  });

  it("renders HTML/script content as text, never as markup (BR-24)", async () => {
    const payload = '<script>alert("xss")</script><b>bold</b>';
    vi.mocked(api.fetchStaffTicketDetail).mockResolvedValue(
      detail({
        publicComments: [
          { id: 1, content: payload, authorId: 7, createdAt: "2026-09-10T00:00:00Z" },
        ],
      }),
    );
    const { container } = render(
      <StaffTicketDetail ticketNumber="TKT-2026-000001" currentUserId={5} onBack={() => {}} />,
    );

    await screen.findByText("TKT-2026-000001");
    // The raw string is present as text content…
    expect(screen.getByText(payload)).toBeTruthy();
    // …and no script/b element was created from it.
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("b")).toBeNull();
  });

  it("shows the failure state when the detail fetch fails", async () => {
    vi.mocked(api.fetchStaffTicketDetail).mockRejectedValue(new Error("Not found"));
    render(<StaffTicketDetail ticketNumber="TKT-2026-000001" currentUserId={5} onBack={() => {}} />);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Not found");
  });
});

describe("UI-STAFF-02 — Status change confirmation (AC-13)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => cleanup());

  it("shows a confirm modal before sending a Resolved transition", async () => {
    vi.mocked(api.fetchStaffTicketDetail).mockResolvedValue(
      detail({ currentStatus: "IN_PROGRESS", ticketOwnerId: 5 }),
    );
    vi.mocked(api.applyStatusTransition).mockResolvedValue({ currentStatus: "RESOLVED" });
    render(<StaffTicketDetail ticketNumber="TKT-2026-000001" currentUserId={5} onBack={() => {}} />);

    await screen.findByText("TKT-2026-000001");
    await userEvent.click(screen.getByRole("button", { name: "Resolved" }));

    // Modal appears; the request has NOT been sent yet.
    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(api.applyStatusTransition).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: /Confirm/i }));
    await waitFor(() =>
      expect(api.applyStatusTransition).toHaveBeenCalledWith("TKT-2026-000001", "RESOLVED"),
    );
  });

  it("cancelling the modal aborts the request", async () => {
    vi.mocked(api.fetchStaffTicketDetail).mockResolvedValue(
      detail({ currentStatus: "IN_PROGRESS", ticketOwnerId: 5 }),
    );
    render(<StaffTicketDetail ticketNumber="TKT-2026-000001" currentUserId={5} onBack={() => {}} />);

    await screen.findByText("TKT-2026-000001");
    await userEvent.click(screen.getByRole("button", { name: "Resolved" }));
    await screen.findByRole("dialog");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(api.applyStatusTransition).not.toHaveBeenCalled();
  });

  it("applies a non-confirmation transition immediately", async () => {
    vi.mocked(api.fetchStaffTicketDetail).mockResolvedValue(
      detail({ currentStatus: "NEW", ticketOwnerId: 5 }),
    );
    vi.mocked(api.applyStatusTransition).mockResolvedValue({ currentStatus: "OPEN" });
    render(<StaffTicketDetail ticketNumber="TKT-2026-000001" currentUserId={5} onBack={() => {}} />);

    await screen.findByText("TKT-2026-000001");
    await userEvent.click(screen.getByRole("button", { name: "Open" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() =>
      expect(api.applyStatusTransition).toHaveBeenCalledWith("TKT-2026-000001", "OPEN"),
    );
  });

  it("handles a 409 safely: shows the message and re-fetches the status", async () => {
    vi.mocked(api.fetchStaffTicketDetail).mockResolvedValue(
      detail({ currentStatus: "NEW", ticketOwnerId: 5 }),
    );
    const conflict = new Error("This status transition is not permitted.") as api.ApiError;
    conflict.status = 409;
    vi.mocked(api.applyStatusTransition).mockRejectedValue(conflict);
    render(<StaffTicketDetail ticketNumber="TKT-2026-000001" currentUserId={5} onBack={() => {}} />);

    await screen.findByText("TKT-2026-000001");
    const callsBefore = vi.mocked(api.fetchStaffTicketDetail).mock.calls.length;
    await userEvent.click(screen.getByRole("button", { name: "Open" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("not permitted");
    // The status was re-fetched after the conflict.
    await waitFor(() =>
      expect(vi.mocked(api.fetchStaffTicketDetail).mock.calls.length).toBeGreaterThan(callsBefore),
    );
  });
});