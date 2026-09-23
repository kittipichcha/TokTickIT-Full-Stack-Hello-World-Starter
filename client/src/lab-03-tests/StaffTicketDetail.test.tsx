/**
 * Frozen Test-DD file: `client/src/lab-03-tests/StaffTicketDetail.test.tsx`
 *
 * Owned by Issue #38. Frozen rows executed here:
 *   - UI-STAFF-01  Staff Ticket Detail (AC-11–14)
 *   - UI-STAFF-02  Status change to Resolved/Closed/Cancelled confirmation (AC-13)
 *
 * Supplementary (never a tests.md row): safe-render assertion (BR-24) — HTML/
 * script content renders as text, never as markup — and the ownership
 * assign/reassign control (FR-16, ui-spec §5.7).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StaffTicketDetail from "../StaffTicketDetail";
import * as api from "../api";

vi.mock("../api");

const OWNERS = [
  { id: 5, name: "Alice", role: "IT_STAFF" },
  { id: 6, name: "Bob", role: "IT_STAFF" },
  { id: 9, name: "Carol", role: "ADMINISTRATOR" },
];

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
    attachments: [],
    ...overrides,
  };
}

describe("UI-STAFF-01 — Staff Ticket Detail (AC-11–14)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.fetchAssignableOwners).mockResolvedValue(OWNERS);
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

  it("disables status transitions until an unassigned ticket is claimed", async () => {
    vi.mocked(api.fetchStaffTicketDetail).mockResolvedValue(
      detail({ currentStatus: "NEW", ticketOwnerId: null }),
    );
    render(<StaffTicketDetail ticketNumber="TKT-2026-000001" currentUserId={5} onBack={() => {}} />);

    await screen.findByText("TKT-2026-000001");
    expect(screen.getByRole("button", { name: "Open" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Cancelled" })).toHaveProperty("disabled", true);
    expect(screen.getByText(/claim or assign this ticket/i)).toBeTruthy();
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

// ---------------------------------------------------------------------------
// Supplementary — ownership assign/reassign control (FR-16, ui-spec §5.7)
// ---------------------------------------------------------------------------

describe("Ownership assign/reassign (FR-16)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.fetchAssignableOwners).mockResolvedValue(OWNERS);
  });
  afterEach(() => cleanup());

  it("reassigns an owned ticket to another eligible staff member", async () => {
    // Ticket owned by Staff A (id 5); current user is Staff B (id 6).
    vi.mocked(api.fetchStaffTicketDetail).mockResolvedValue(detail({ ticketOwnerId: 5 }));
    vi.mocked(api.setTicketOwner).mockResolvedValue({ ticketOwnerId: 9 });
    render(<StaffTicketDetail ticketNumber="TKT-2026-000001" currentUserId={6} onBack={() => {}} />);

    await screen.findByText("TKT-2026-000001");
    await userEvent.selectOptions(await screen.findByLabelText("Ticket Owner"), "9");
    await userEvent.click(screen.getByRole("button", { name: /^Reassign$/i }));

    await waitFor(() => expect(api.setTicketOwner).toHaveBeenCalledWith("TKT-2026-000001", 9));
  });

  it("assigns an unowned ticket to a selected eligible owner", async () => {
    vi.mocked(api.fetchStaffTicketDetail).mockResolvedValue(detail({ ticketOwnerId: null }));
    vi.mocked(api.setTicketOwner).mockResolvedValue({ ticketOwnerId: 9 });
    render(<StaffTicketDetail ticketNumber="TKT-2026-000001" currentUserId={6} onBack={() => {}} />);

    await screen.findByText("TKT-2026-000001");
    await userEvent.selectOptions(await screen.findByLabelText("Ticket Owner"), "9");
    await userEvent.click(screen.getByRole("button", { name: /^Assign$/i }));

    await waitFor(() => expect(api.setTicketOwner).toHaveBeenCalledWith("TKT-2026-000001", 9));
  });

  it("offers only eligible owners (no Requesters or inactive users)", async () => {
    vi.mocked(api.fetchStaffTicketDetail).mockResolvedValue(detail());
    render(<StaffTicketDetail ticketNumber="TKT-2026-000001" currentUserId={6} onBack={() => {}} />);

    await screen.findByText("TKT-2026-000001");
    await waitFor(() => expect(screen.getByRole("option", { name: /Alice — IT Staff/ })).toBeTruthy());
    expect(screen.getByRole("option", { name: /Bob — IT Staff/ })).toBeTruthy();
    expect(screen.getByRole("option", { name: /Carol — Administrator/ })).toBeTruthy();
    // The Requester from the detail payload is never offered as an owner.
    expect(screen.queryByRole("option", { name: /Ada Lovelace/ })).toBeNull();
  });

  it("keeps the claim-to-me convenience action available", async () => {
    vi.mocked(api.fetchStaffTicketDetail).mockResolvedValue(detail({ ticketOwnerId: null }));
    vi.mocked(api.setTicketOwner).mockResolvedValue({ ticketOwnerId: 6 });
    render(<StaffTicketDetail ticketNumber="TKT-2026-000001" currentUserId={6} onBack={() => {}} />);

    await screen.findByText("TKT-2026-000001");
    await userEvent.click(screen.getByRole("button", { name: /Claim \/ Reassign to me/i }));
    await waitFor(() => expect(api.setTicketOwner).toHaveBeenCalledWith("TKT-2026-000001", 6));
  });

  it("surfaces a 409 failure without displaying a false owner", async () => {
    vi.mocked(api.fetchStaffTicketDetail).mockResolvedValue(detail({ ticketOwnerId: 5 }));
    vi.mocked(api.setTicketOwner).mockRejectedValue(
      new Error("The specified owner is not an active IT Staff or Administrator user."),
    );
    render(<StaffTicketDetail ticketNumber="TKT-2026-000001" currentUserId={6} onBack={() => {}} />);

    await screen.findByText("TKT-2026-000001");
    await userEvent.selectOptions(await screen.findByLabelText("Ticket Owner"), "9");
    await userEvent.click(screen.getByRole("button", { name: /^Reassign$/i }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("not an active IT Staff or Administrator");

    // The selector resets and the displayed owner is still the persisted one.
    await waitFor(() =>
      expect((screen.getByLabelText("Ticket Owner") as HTMLSelectElement).value).toBe(""),
    );
    expect(screen.getByText("User #5")).toBeTruthy();
    // The user can retry.
    expect(screen.getByRole("button", { name: /^Reassign$/i })).toBeTruthy();
  });
});

describe("UI-STAFF-02 — Status change confirmation (AC-13)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.fetchAssignableOwners).mockResolvedValue(OWNERS);
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

  it("restores focus before a confirmed transition refetch unmounts the detail", async () => {
    let resolveRefetch: ((value: api.StaffTicketDetail) => void) | undefined;
    vi.mocked(api.fetchStaffTicketDetail)
      .mockResolvedValueOnce(detail({ currentStatus: "IN_PROGRESS", ticketOwnerId: 5 }))
      .mockImplementationOnce(
        () => new Promise((resolve) => {
          resolveRefetch = resolve;
        }),
      );
    vi.mocked(api.applyStatusTransition).mockResolvedValue({ currentStatus: "RESOLVED" });
    render(<StaffTicketDetail ticketNumber="TKT-2026-000001" currentUserId={5} onBack={() => {}} />);

    await screen.findByText("TKT-2026-000001");
    const trigger = screen.getByRole("button", { name: "Resolved" });
    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole("button", { name: /Confirm/i }));
    await waitFor(() => expect(api.applyStatusTransition).toHaveBeenCalled());
    expect(document.activeElement).toBe(trigger);

    resolveRefetch?.(detail({ currentStatus: "RESOLVED", ticketOwnerId: 5 }));
    await waitFor(() => expect(screen.getByText("RESOLVED")).toBeTruthy());
    expect(document.activeElement?.isConnected).toBe(true);
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

// ---------------------------------------------------------------------------
// Issue #38 review fix (49-B2) — Existing Attachments on the Staff Detail
// (ui-spec §5.7). Read-only: view/preview/download only, never upload/remove.
// ---------------------------------------------------------------------------

const ATTACHMENTS: api.AttachmentItem[] = [
  {
    id: 10,
    originalFilename: "photo.jpg",
    mimeType: "image/jpeg",
    fileSizeBytes: 12345,
    uploadedAt: "2026-09-10T00:00:00Z",
    isRemoved: false,
    removedAt: null,
    removalReason: null,
    removedByUserId: null,
  },
  {
    id: 11,
    originalFilename: "report.pdf",
    mimeType: "application/pdf",
    fileSizeBytes: 54321,
    uploadedAt: "2026-09-11T00:00:00Z",
    isRemoved: true,
    removedAt: "2026-09-12T00:00:00Z",
    removalReason: "Duplicate upload",
    removedByUserId: 7,
  },
];

describe("UI-49-ATT — Staff Detail Existing Attachments (49-B2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.fetchAssignableOwners).mockResolvedValue(OWNERS);
    // jsdom does not implement these browser APIs; stub them so the
    // Preview/Download paths can be exercised without noisy errors.
    vi.spyOn(window, "open").mockImplementation(() => null);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("UI-49-ATT-01 — lists the ticket's existing attachments", async () => {
    vi.mocked(api.fetchStaffTicketDetail).mockResolvedValue(detail({ attachments: ATTACHMENTS }));
    render(<StaffTicketDetail ticketNumber="TKT-2026-000001" currentUserId={5} onBack={() => {}} />);

    await screen.findByText("TKT-2026-000001");
    expect(screen.getByText("photo.jpg")).toBeTruthy();
    expect(screen.getByText("report.pdf")).toBeTruthy();
  });

  it("UI-49-ATT-02 — exposes Preview and Download for an active attachment", async () => {
    vi.mocked(api.fetchStaffTicketDetail).mockResolvedValue(
      detail({ attachments: [ATTACHMENTS[0]] }),
    );
    vi.mocked(api.previewAttachmentFile).mockResolvedValue({
      blob: new Blob(["x"]),
      mimeType: "image/jpeg",
    });
    vi.mocked(api.downloadAttachmentFile).mockResolvedValue({
      blob: new Blob(["x"]),
      filename: "photo.jpg",
    });
    render(<StaffTicketDetail ticketNumber="TKT-2026-000001" currentUserId={5} onBack={() => {}} />);

    await screen.findByText("TKT-2026-000001");
    await userEvent.click(screen.getByRole("button", { name: "Preview" }));
    await waitFor(() => expect(api.previewAttachmentFile).toHaveBeenCalledWith(10));

    await userEvent.click(screen.getByRole("button", { name: "Download" }));
    await waitFor(() => expect(api.downloadAttachmentFile).toHaveBeenCalledWith(10));
  });

  it("UI-49-ATT-03 — represents a removed attachment safely", async () => {
    vi.mocked(api.fetchStaffTicketDetail).mockResolvedValue(
      detail({ attachments: [ATTACHMENTS[1]] }),
    );
    render(<StaffTicketDetail ticketNumber="TKT-2026-000001" currentUserId={5} onBack={() => {}} />);

    await screen.findByText("TKT-2026-000001");
    expect(screen.getByText("Removed")).toBeTruthy();
    expect(screen.getByText("Duplicate upload")).toBeTruthy();
    // Preview/Download are disabled for a removed attachment.
    expect((screen.getByRole("button", { name: "Preview" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Download" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("UI-49-ATT-04 — never exposes Upload or Remove controls", async () => {
    vi.mocked(api.fetchStaffTicketDetail).mockResolvedValue(detail({ attachments: ATTACHMENTS }));
    render(<StaffTicketDetail ticketNumber="TKT-2026-000001" currentUserId={5} onBack={() => {}} />);

    await screen.findByText("TKT-2026-000001");
    expect(screen.queryByRole("button", { name: /upload/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /add attachment/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^remove$/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /delete/i })).toBeNull();
  });

  it("UI-49-ATT-05 — a failed preview marks the attachment unavailable", async () => {
    vi.mocked(api.fetchStaffTicketDetail).mockResolvedValue(
      detail({ attachments: [ATTACHMENTS[0]] }),
    );
    vi.mocked(api.previewAttachmentFile).mockRejectedValue(new Error("Attachment is unavailable."));
    render(<StaffTicketDetail ticketNumber="TKT-2026-000001" currentUserId={5} onBack={() => {}} />);

    await screen.findByText("TKT-2026-000001");
    await userEvent.click(screen.getByRole("button", { name: "Preview" }));

    expect(await screen.findByText("Unavailable")).toBeTruthy();
    expect(screen.getByText("Attachment is unavailable.")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Issue #38 review fix (49-B4) — status confirmation modal keyboard/focus
// behavior (ui-spec §8: modal dialogs trap focus and are closable via Esc).
// ---------------------------------------------------------------------------

describe("UI-49-MODAL — confirmation modal focus behavior (49-B4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.fetchAssignableOwners).mockResolvedValue(OWNERS);
  });
  afterEach(() => cleanup());

  async function openModal(target: "Resolved" | "Closed" | "Cancelled", status: string) {
    vi.mocked(api.fetchStaffTicketDetail).mockResolvedValue(
      detail({ currentStatus: status, ticketOwnerId: 5 }),
    );
    render(<StaffTicketDetail ticketNumber="TKT-2026-000001" currentUserId={5} onBack={() => {}} />);
    await screen.findByText("TKT-2026-000001");
    const trigger = screen.getByRole("button", { name: target });
    await userEvent.click(trigger);
    await screen.findByRole("dialog");
    return trigger;
  }

  it("UI-49-MODAL-01 — opens the modal for Resolved", async () => {
    await openModal("Resolved", "IN_PROGRESS");
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("UI-49-MODAL-02 — opens the modal for Closed", async () => {
    await openModal("Closed", "RESOLVED");
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("UI-49-MODAL-03 — opens the modal for Cancelled", async () => {
    await openModal("Cancelled", "NEW");
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("UI-49-MODAL-04 — initial focus enters the modal", async () => {
    await openModal("Resolved", "IN_PROGRESS");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cancel" }));
  });

  it("UI-49-MODAL-05 — Tab cannot escape the modal", async () => {
    await openModal("Resolved", "IN_PROGRESS");
    const confirm = screen.getByRole("button", { name: "Confirm" });
    confirm.focus();
    await userEvent.tab();
    // Wraps back to the first focusable control inside the dialog.
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cancel" }));
  });

  it("UI-49-MODAL-06 — Shift+Tab cannot escape the modal", async () => {
    await openModal("Resolved", "IN_PROGRESS");
    const cancel = screen.getByRole("button", { name: "Cancel" });
    cancel.focus();
    await userEvent.tab({ shift: true });
    // Wraps to the last focusable control inside the dialog.
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Confirm" }));
  });

  it("UI-49-MODAL-07 — Escape closes without calling the API", async () => {
    await openModal("Resolved", "IN_PROGRESS");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(api.applyStatusTransition).not.toHaveBeenCalled();
  });

  it("UI-49-MODAL-08 — Cancel closes without calling the API", async () => {
    await openModal("Resolved", "IN_PROGRESS");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(api.applyStatusTransition).not.toHaveBeenCalled();
  });

  it("UI-49-MODAL-09 — Confirm calls the API exactly once", async () => {
    vi.mocked(api.applyStatusTransition).mockResolvedValue({ currentStatus: "RESOLVED" });
    await openModal("Resolved", "IN_PROGRESS");
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() =>
      expect(api.applyStatusTransition).toHaveBeenCalledWith("TKT-2026-000001", "RESOLVED"),
    );
    expect(vi.mocked(api.applyStatusTransition).mock.calls.length).toBe(1);
  });

  it("UI-49-MODAL-10 — focus returns to the invoking control after close", async () => {
    const trigger = await openModal("Resolved", "IN_PROGRESS");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });
});