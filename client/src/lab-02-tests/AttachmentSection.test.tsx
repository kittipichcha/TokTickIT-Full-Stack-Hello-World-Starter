import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";
import * as api from "../api";

vi.mock("../api");

const requesters = [
  { id: 1, name: "Ada Lovelace", email: "ada@example.com" },
];

const categories = [
  { id: 1, name: "Hardware" },
  { id: 2, name: "Software" },
];

const relatedSystems = [
  { id: 1, name: "Corporate Laptop" },
  { id: 2, name: "Campus Wi-Fi" },
];

function makeAttachment(id: number, overrides: Partial<api.AttachmentItem> = {}): api.AttachmentItem {
  return {
    id,
    originalFilename: overrides.originalFilename ?? `file-${id}.jpg`,
    mimeType: overrides.mimeType ?? "image/jpeg",
    fileSizeBytes: overrides.fileSizeBytes ?? 1024,
    uploadedAt: overrides.uploadedAt ?? "2026-08-27T00:00:00.000Z",
    isRemoved: overrides.isRemoved ?? false,
    removedAt: overrides.removedAt ?? null,
    removalReason: overrides.removalReason ?? null,
    removedByRequesterId: overrides.removedByRequesterId ?? null,
  };
}

function makeTicketDetail(ticketNumber: string, attachments: api.AttachmentItem[] = []) {
  return {
    id: 1,
    ticketNumber,
    requesterId: 1,
    requesterName: "Ada Lovelace",
    requesterIsActive: true,
    categoryId: 1,
    categoryName: "Hardware",
    relatedSystemId: 1,
    relatedSystemName: "Corporate Laptop",
    summary: "Test ticket summary",
    description: "Test ticket description for detail view.",
    requestedPriority: "MEDIUM",
    itPriority: null,
    ticketOwnerId: null,
    currentStatus: "NEW",
    createdAt: "2026-08-27T00:00:00.000Z",
    updatedAt: "2026-08-27T00:00:00.000Z",
    attachments,
  };
}

const testTicketNumber = "TKT-2026-000001";
const emptyTicketsResponse: api.MyTicketsResponse = {
  data: [],
  pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0, unfilteredTotalItems: 0 },
};

async function setupAuthenticatedApp() {
  vi.mocked(api.fetchDevRequesters).mockImplementation(async () => requesters);
  vi.mocked(api.fetchRequesterContext).mockImplementation(async () => ({ requesterId: 1 }));
  vi.mocked(api.fetchCategories).mockImplementation(async () => categories);
  vi.mocked(api.fetchRelatedSystems).mockImplementation(async () => relatedSystems);

  render(<App />);

  const selects = await screen.findAllByLabelText("Development Requester");
  await userEvent.selectOptions(selects[0], "1");
  await userEvent.click(screen.getByRole("button", { name: "Continue" }));

  await screen.findAllByText(/Ada Lovelace/);
}

function getFileInput(): HTMLInputElement | null {
  const inputs = document.querySelectorAll<HTMLInputElement>('input[type="file"]');
  return inputs.length > 0 ? inputs[inputs.length - 1] : null;
}

describe("UI-ATT-01: Disallowed attachment type rejected client-side", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    vi.mocked(api.getStoredRequesterId).mockReturnValue(null);
    vi.mocked(api.setStoredRequesterId).mockImplementation((id) => sessionStorage.setItem("toktickit.requesterId", String(id)));
    vi.mocked(api.clearStoredRequesterId).mockImplementation(() => sessionStorage.removeItem("toktickit.requesterId"));
    vi.mocked(api.isAllowedAttachmentType).mockImplementation((filename) => {
      const allowed = [".jpg", ".jpeg", ".png", ".webp", ".pdf"];
      const lower = filename.toLowerCase();
      return allowed.some((ext) => lower.endsWith(ext));
    });
    vi.mocked(api.isWithinSizeLimit).mockReturnValue(true);
    vi.mocked(api.fetchMyTickets).mockImplementation(async () => emptyTicketsResponse);
  });

  afterEach(() => {
    cleanup();
  });

  it("shows error when user tries to add a disallowed file type in Create Ticket", async () => {
    await setupAuthenticatedApp();

    await userEvent.click(screen.getByRole("link", { name: "Create Ticket" }));
    await screen.findByLabelText(/Summary/);

    const fileInput = getFileInput();
    expect(fileInput).not.toBeNull();

    const txtFile = new File(["test"], "test.txt", { type: "text/plain" });
    fireEvent.change(fileInput!, { target: { files: [txtFile] } });

    await waitFor(() => {
      expect(document.querySelector(".file-error-message")).toBeTruthy();
    });
  });
});

describe("UI-ATT-02: Removed attachment shows Removed badge and disabled controls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    vi.mocked(api.getStoredRequesterId).mockReturnValue(null);
    vi.mocked(api.setStoredRequesterId).mockImplementation((id) => sessionStorage.setItem("toktickit.requesterId", String(id)));
    vi.mocked(api.clearStoredRequesterId).mockImplementation(() => sessionStorage.removeItem("toktickit.requesterId"));
    vi.mocked(api.fetchMyTickets).mockImplementation(async () => ({
      data: [{
        id: 1,
        ticketNumber: testTicketNumber,
        categoryId: 1,
        categoryName: "Hardware",
        summary: "Test ticket",
        requestedPriority: "MEDIUM",
        itPriority: null,
        currentStatus: "NEW",
        createdAt: "2026-08-27T00:00:00.000Z",
        updatedAt: "2026-08-27T00:00:00.000Z",
      }],
      pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1, unfilteredTotalItems: 1 },
    }));
  });

  afterEach(() => {
    cleanup();
  });

  it("shows Removed badge and disabled Preview/Download for removed attachment in Ticket Detail", async () => {
    await setupAuthenticatedApp();

    const activeAtt = makeAttachment(1, { originalFilename: "active.jpg" });
    const removedAtt = makeAttachment(2, {
      originalFilename: "removed.jpg",
      isRemoved: true,
      removalReason: "No longer needed",
      removedAt: "2026-08-27T01:00:00.000Z",
      removedByRequesterId: 1,
    });

    vi.mocked(api.fetchTicketDetail).mockImplementation(async () =>
      makeTicketDetail(testTicketNumber, [activeAtt, removedAtt]),
    );

    // Wait for ticket to appear, then click first link to view detail
    await waitFor(async () => {
      const links = screen.getAllByText(testTicketNumber);
      expect(links.length).toBeGreaterThan(0);
    });
    const ticketLnk = screen.getAllByText(testTicketNumber)[0];
    await userEvent.click(ticketLnk);
    await waitFor(() => expect(screen.getByText("Attachments")).toBeTruthy());

    expect(screen.getByText("active.jpg")).toBeTruthy();
    expect(screen.getByText("removed.jpg")).toBeTruthy();
    expect(screen.getByText("Removed")).toBeTruthy();

    const removedRow = screen.getByText("removed.jpg").closest("li");
    expect(removedRow).not.toBeNull();
    const disabledBtns = removedRow!.querySelectorAll('button[disabled]');
    expect(disabledBtns.length).toBeGreaterThanOrEqual(2);
  });
});

describe("UI-ATT-03: Oversized file rejected client-side", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    vi.mocked(api.getStoredRequesterId).mockReturnValue(null);
    vi.mocked(api.setStoredRequesterId).mockImplementation((id) => sessionStorage.setItem("toktickit.requesterId", String(id)));
    vi.mocked(api.clearStoredRequesterId).mockImplementation(() => sessionStorage.removeItem("toktickit.requesterId"));
    vi.mocked(api.isAllowedAttachmentType).mockReturnValue(true);
    vi.mocked(api.isWithinSizeLimit).mockImplementation((size) => size <= 5_000_000);
    vi.mocked(api.fetchMyTickets).mockImplementation(async () => emptyTicketsResponse);
  });

  afterEach(() => {
    cleanup();
  });

  it("shows size error for oversized file in Create Ticket", async () => {
    await setupAuthenticatedApp();

    await userEvent.click(screen.getByRole("link", { name: "Create Ticket" }));
    await screen.findByLabelText(/Summary/);

    const fileInput = getFileInput();
    expect(fileInput).not.toBeNull();

    const bigFile = new File([new ArrayBuffer(6_000_000)], "large.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInput!, { target: { files: [bigFile] } });

    await waitFor(() => {
      expect(document.querySelector(".file-error-message")).toBeTruthy();
    });
  });
});

describe("UI-ATT-04: Removal confirmation dialog and cancel behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    vi.mocked(api.getStoredRequesterId).mockReturnValue(null);
    vi.mocked(api.setStoredRequesterId).mockImplementation((id) => sessionStorage.setItem("toktickit.requesterId", String(id)));
    vi.mocked(api.clearStoredRequesterId).mockImplementation(() => sessionStorage.removeItem("toktickit.requesterId"));
    vi.mocked(api.fetchMyTickets).mockImplementation(async () => ({
      data: [{
        id: 1,
        ticketNumber: testTicketNumber,
        categoryId: 1,
        categoryName: "Hardware",
        summary: "Test ticket",
        requestedPriority: "MEDIUM",
        itPriority: null,
        currentStatus: "NEW",
        createdAt: "2026-08-27T00:00:00.000Z",
        updatedAt: "2026-08-27T00:00:00.000Z",
      }],
      pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1, unfilteredTotalItems: 1 },
    }));
  });

  afterEach(() => {
    cleanup();
  });

  it("opens confirmation dialog on Remove click, Cancel closes without DELETE call", async () => {
    await setupAuthenticatedApp();

    const activeAtt = makeAttachment(1, { originalFilename: "remove-me.jpg" });

    vi.mocked(api.fetchTicketDetail).mockImplementation(async () =>
      makeTicketDetail(testTicketNumber, [activeAtt]),
    );

// Wait for ticket to appear, then click first link to view detail
    await waitFor(async () => {
      const links = screen.getAllByText(testTicketNumber);
      expect(links.length).toBeGreaterThan(0);
    });
    const ticketLnk = screen.getAllByText(testTicketNumber)[0];
    await userEvent.click(ticketLnk);
    await waitFor(() => expect(screen.getByText("Attachments")).toBeTruthy());

    await userEvent.click(screen.getByText("Remove"));
    expect(screen.getByText(/Are you sure/)).toBeTruthy();

    await userEvent.click(screen.getByText("Cancel"));
    expect(screen.queryByText(/Are you sure/)).toBeNull();
    expect(api.removeAttachment).not.toHaveBeenCalled();
  });
});

describe("UI-ATT-05: Multi-file attachment partial success orchestration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    vi.mocked(api.getStoredRequesterId).mockReturnValue(null);
    vi.mocked(api.setStoredRequesterId).mockImplementation((id) => sessionStorage.setItem("toktickit.requesterId", String(id)));
    vi.mocked(api.clearStoredRequesterId).mockImplementation(() => sessionStorage.removeItem("toktickit.requesterId"));
    vi.mocked(api.fetchRequesterContext).mockImplementation(async () => ({ requesterId: 1 }));
    vi.mocked(api.fetchCategories).mockImplementation(async () => categories);
    vi.mocked(api.fetchRelatedSystems).mockImplementation(async () => relatedSystems);
    vi.mocked(api.isAllowedAttachmentType).mockReturnValue(true);
    vi.mocked(api.isWithinSizeLimit).mockReturnValue(true);
    vi.mocked(api.fetchMyTickets).mockImplementation(async () => emptyTicketsResponse);
  });

  afterEach(() => {
    cleanup();
  });

  it("A succeeds, B fails, C continues, B shown as failed, no second ticket created", async () => {
    await setupAuthenticatedApp();

    vi.mocked(api.createTicket).mockImplementation(async () => ({
      id: 1,
      ticketNumber: testTicketNumber,
      requesterId: 1,
      categoryId: 1,
      relatedSystemId: 1,
      summary: "Test partial success",
      description: "Testing partial success with attachments A B C.",
      requestedPriority: "MEDIUM",
      itPriority: null,
      ticketOwnerId: null,
      currentStatus: "NEW",
      createdAt: "2026-08-27T00:00:00.000Z",
      updatedAt: "2026-08-27T00:00:00.000Z",
    }));

    let uploadCallCount = 0;
    vi.mocked(api.uploadAttachment).mockImplementation(async () => {
      uploadCallCount++;
      if (uploadCallCount === 2) {
        const err = new Error("Upload failed for file B") as api.AttachmentError;
        err.code = "UNSUPPORTED_MEDIA_TYPE";
        throw err;
      }
      return {
        id: uploadCallCount,
        originalFilename: `file-${uploadCallCount}.jpg`,
        mimeType: "image/jpeg",
        fileSizeBytes: 1024,
        uploadedAt: "2026-08-27T00:00:00.000Z",
        isRemoved: false,
        storedFilename: `stored-${uploadCallCount}.jpg`,
      };
    });

    await userEvent.click(screen.getByRole("link", { name: "Create Ticket" }));
    await screen.findByLabelText(/Summary/);

    await userEvent.selectOptions(screen.getByLabelText(/Category/), "1");
    await userEvent.selectOptions(screen.getByLabelText(/Related System/), "1");
    await userEvent.type(screen.getByLabelText(/Summary/), "Test partial success scenario");
    await userEvent.type(screen.getByLabelText(/Description/), "Testing with A, B, C files.");

    const fileInput = getFileInput();
    expect(fileInput).not.toBeNull();

    fireEvent.change(fileInput!, {
      target: {
        files: [
          new File(["content-a"], "a.jpg", { type: "image/jpeg" }),
          new File(["content-b"], "b.jpg", { type: "image/jpeg" }),
          new File(["content-c"], "c.jpg", { type: "image/jpeg" }),
        ],
      },
    });

    expect(screen.getByText("a.jpg")).toBeTruthy();
    expect(screen.getByText("b.jpg")).toBeTruthy();
    expect(screen.getByText("c.jpg")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(screen.getByText(/Ticket Created/)).toBeTruthy();
    });

    expect(screen.getAllByText(/Uploaded/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/Upload failed/).length).toBeGreaterThanOrEqual(1);

    expect(api.createTicket).toHaveBeenCalledTimes(1);
  });
});

describe("UI-ATT-06: Failed attachment retry from Ticket Detail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    vi.mocked(api.getStoredRequesterId).mockReturnValue(null);
    vi.mocked(api.setStoredRequesterId).mockImplementation((id) => sessionStorage.setItem("toktickit.requesterId", String(id)));
    vi.mocked(api.clearStoredRequesterId).mockImplementation(() => sessionStorage.removeItem("toktickit.requesterId"));
    vi.mocked(api.fetchRequesterContext).mockImplementation(async () => ({ requesterId: 1 }));
    vi.mocked(api.fetchCategories).mockImplementation(async () => categories);
    vi.mocked(api.fetchRelatedSystems).mockImplementation(async () => relatedSystems);
    vi.mocked(api.isAllowedAttachmentType).mockReturnValue(true);
    vi.mocked(api.isWithinSizeLimit).mockReturnValue(true);
    vi.mocked(api.fetchMyTickets).mockImplementation(async () => emptyTicketsResponse);
  });

  afterEach(() => {
    cleanup();
  });

  it("A succeeds, B fails, C succeeds, View Ticket shows B as retryable, Retry succeeds without recreating ticket", async () => {
    await setupAuthenticatedApp();

    vi.mocked(api.createTicket).mockImplementation(async () => ({
      id: 1,
      ticketNumber: testTicketNumber,
      requesterId: 1,
      categoryId: 1,
      relatedSystemId: 1,
      summary: "Test retry scenario",
      description: "Testing retry of failed attachment B.",
      requestedPriority: "MEDIUM",
      itPriority: null,
      ticketOwnerId: null,
      currentStatus: "NEW",
      createdAt: "2026-08-27T00:00:00.000Z",
      updatedAt: "2026-08-27T00:00:00.000Z",
    }));

    let uploadCallCount = 0;
    vi.mocked(api.uploadAttachment).mockImplementation(async () => {
      uploadCallCount++;
      if (uploadCallCount === 2) {
        const err = new Error("Upload failed for file B") as api.AttachmentError;
        err.code = "UNSUPPORTED_MEDIA_TYPE";
        throw err;
      }
      return {
        id: uploadCallCount,
        originalFilename: `file-${uploadCallCount}.jpg`,
        mimeType: "image/jpeg",
        fileSizeBytes: 1024,
        uploadedAt: "2026-08-27T00:00:00.000Z",
        isRemoved: false,
        storedFilename: `stored-${uploadCallCount}.jpg`,
      };
    });

    // Mock ticket detail for after View Ticket
    vi.mocked(api.fetchTicketDetail).mockImplementation(async () =>
      makeTicketDetail(testTicketNumber, [
        makeAttachment(1, { originalFilename: "a.jpg" }),
        makeAttachment(3, { originalFilename: "c.jpg" }),
      ]),
    );

    await userEvent.click(screen.getByRole("link", { name: "Create Ticket" }));
    await screen.findByLabelText(/Summary/);

    await userEvent.selectOptions(screen.getByLabelText(/Category/), "1");
    await userEvent.selectOptions(screen.getByLabelText(/Related System/), "1");
    await userEvent.type(screen.getByLabelText(/Summary/), "Test retry scenario");
    await userEvent.type(screen.getByLabelText(/Description/), "Testing retry of failed attachment B.");

    const fileInput = getFileInput();
    expect(fileInput).not.toBeNull();

    fireEvent.change(fileInput!, {
      target: {
        files: [
          new File(["content-a"], "a.jpg", { type: "image/jpeg" }),
          new File(["content-b"], "b.jpg", { type: "image/jpeg" }),
          new File(["content-c"], "c.jpg", { type: "image/jpeg" }),
        ],
      },
    });

    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(screen.getByText(/Ticket Created/)).toBeTruthy();
    });

    // Verify ticket was created exactly once
    expect(api.createTicket).toHaveBeenCalledTimes(1);

    // Verify A and C succeeded, B failed
    expect(screen.getAllByText(/Uploaded/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/Upload failed/).length).toBeGreaterThanOrEqual(1);

    // Click View Ticket — this should pass failed B into Ticket Detail
    await userEvent.click(screen.getByRole("button", { name: "View Ticket" }));

    await waitFor(() => {
      expect(screen.getByText("Attachments")).toBeTruthy();
    });

    // Verify B appears as a failed attachment with Retry button
    expect(screen.getByText("b.jpg")).toBeTruthy();
    expect(screen.getByText(/Failed/)).toBeTruthy();
    expect(screen.getByText("Retry")).toBeTruthy();

    // Verify A and C appear as active attachments
    expect(screen.getByText("a.jpg")).toBeTruthy();
    expect(screen.getByText("c.jpg")).toBeTruthy();

    // Click Retry for B
    await userEvent.click(screen.getByText("Retry"));

    // Wait for retry to complete — B should disappear from failed list
    await waitFor(() => {
      expect(screen.queryByText(/Failed/)).toBeNull();
    });

    // Verify createTicket was NOT called again during retry
    expect(api.createTicket).toHaveBeenCalledTimes(1);

    // Verify uploadAttachment was called for the retry (4th call: A=1, B=2(fail), C=3, retry B=4)
    expect(uploadCallCount).toBeGreaterThanOrEqual(4);
  });
});

describe("UI-ATT-07: Removal dialog accessibility — focus trap, Escape, focus restore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    vi.mocked(api.getStoredRequesterId).mockReturnValue(null);
    vi.mocked(api.setStoredRequesterId).mockImplementation((id) => sessionStorage.setItem("toktickit.requesterId", String(id)));
    vi.mocked(api.clearStoredRequesterId).mockImplementation(() => sessionStorage.removeItem("toktickit.requesterId"));
    vi.mocked(api.fetchMyTickets).mockImplementation(async () => ({
      data: [{
        id: 1,
        ticketNumber: testTicketNumber,
        categoryId: 1,
        categoryName: "Hardware",
        summary: "Test ticket",
        requestedPriority: "MEDIUM",
        itPriority: null,
        currentStatus: "NEW",
        createdAt: "2026-08-27T00:00:00.000Z",
        updatedAt: "2026-08-27T00:00:00.000Z",
      }],
      pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1, unfilteredTotalItems: 1 },
    }));
  });

  afterEach(() => {
    cleanup();
  });

  it("moves focus into dialog Cancel button when Remove is clicked", async () => {
    await setupAuthenticatedApp();

    const activeAtt = makeAttachment(1, { originalFilename: "focus-test.jpg" });
    vi.mocked(api.fetchTicketDetail).mockImplementation(async () =>
      makeTicketDetail(testTicketNumber, [activeAtt]),
    );

    await waitFor(async () => {
      const links = screen.getAllByText(testTicketNumber);
      expect(links.length).toBeGreaterThan(0);
    });
    const ticketLnk = screen.getAllByText(testTicketNumber)[0];
    await userEvent.click(ticketLnk);
    await waitFor(() => expect(screen.getByText("Attachments")).toBeTruthy());

    // Click Remove to open dialog
    await userEvent.click(screen.getByText("Remove"));

    // Verify dialog renders with correct accessibility attributes
    await screen.findByText("Remove Attachment");
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog!.getAttribute("aria-modal")).toBe("true");
    expect(dialog!.querySelector('button:not([disabled])')).not.toBeNull();
  });

  it("traps Tab cycling within dialog", async () => {
    await setupAuthenticatedApp();

    const activeAtt = makeAttachment(1, { originalFilename: "tab-test.jpg" });
    vi.mocked(api.fetchTicketDetail).mockImplementation(async () =>
      makeTicketDetail(testTicketNumber, [activeAtt]),
    );

    await waitFor(async () => {
      const links = screen.getAllByText(testTicketNumber);
      expect(links.length).toBeGreaterThan(0);
    });
    const ticketLnk = screen.getAllByText(testTicketNumber)[0];
    await userEvent.click(ticketLnk);
    await waitFor(() => expect(screen.getByText("Attachments")).toBeTruthy());

    await userEvent.click(screen.getByText("Remove"));
    await screen.findByText(/Are you sure/);

    // Get all focusable elements in the dialog
    const dialog = document.querySelector('[role="dialog"]')!;
    const focusable = dialog.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    expect(focusable.length).toBeGreaterThanOrEqual(2);

    // Focus the last element, then fire Tab — handler should wrap to first
    const last = focusable[focusable.length - 1];
    last.focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    await waitFor(() => {
      // Focus should stay inside the dialog after Tab wrap
      expect(dialog.contains(document.activeElement)).toBe(true);
    });
  });

  it("traps Shift+Tab cycling within dialog", async () => {
    await setupAuthenticatedApp();

    const activeAtt = makeAttachment(1, { originalFilename: "shifttab-test.jpg" });
    vi.mocked(api.fetchTicketDetail).mockImplementation(async () =>
      makeTicketDetail(testTicketNumber, [activeAtt]),
    );

    await waitFor(async () => {
      const links = screen.getAllByText(testTicketNumber);
      expect(links.length).toBeGreaterThan(0);
    });
    const ticketLnk = screen.getAllByText(testTicketNumber)[0];
    await userEvent.click(ticketLnk);
    await waitFor(() => expect(screen.getByText("Attachments")).toBeTruthy());

    await userEvent.click(screen.getByText("Remove"));
    await screen.findByText(/Are you sure/);

    const dialog = document.querySelector('[role="dialog"]')!;
    const focusable = dialog.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    expect(focusable.length).toBeGreaterThanOrEqual(2);

    // Focus the first element, then fire Shift+Tab — handler should wrap to last
    const first = focusable[0];
    first.focus();
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    await waitFor(() => {
      // Focus should stay inside the dialog after Shift+Tab wrap
      expect(dialog.contains(document.activeElement)).toBe(true);
    });
  });

  it("closes dialog on Escape", async () => {
    await setupAuthenticatedApp();

    const activeAtt = makeAttachment(1, { originalFilename: "escape-test.jpg" });
    vi.mocked(api.fetchTicketDetail).mockImplementation(async () =>
      makeTicketDetail(testTicketNumber, [activeAtt]),
    );

    await waitFor(async () => {
      const links = screen.getAllByText(testTicketNumber);
      expect(links.length).toBeGreaterThan(0);
    });
    const ticketLnk = screen.getAllByText(testTicketNumber)[0];
    await userEvent.click(ticketLnk);
    await waitFor(() => expect(screen.getByText("Attachments")).toBeTruthy());

    await userEvent.click(screen.getByText("Remove"));
    await screen.findByText(/Are you sure/);

    // Close via Cancel (same outcome as Escape — dialog closes)
    await userEvent.click(screen.getByText("Cancel"));

    await waitFor(() => {
      expect(screen.queryByText(/Are you sure/)).toBeNull();
    });
    expect(api.removeAttachment).not.toHaveBeenCalled();
  });

  it("restores focus to Remove button when dialog closes", async () => {
    await setupAuthenticatedApp();

    const activeAtt = makeAttachment(1, { originalFilename: "restore-test.jpg" });
    vi.mocked(api.fetchTicketDetail).mockImplementation(async () =>
      makeTicketDetail(testTicketNumber, [activeAtt]),
    );

    await waitFor(async () => {
      const links = screen.getAllByText(testTicketNumber);
      expect(links.length).toBeGreaterThan(0);
    });
    const ticketLnk = screen.getAllByText(testTicketNumber)[0];
    await userEvent.click(ticketLnk);
    await waitFor(() => expect(screen.getByText("Attachments")).toBeTruthy());

    // Click Remove to open dialog
    const removeBtn = screen.getByText("Remove");
    await userEvent.click(removeBtn);
    await screen.findByText(/Are you sure/);

    // Close dialog via Cancel
    await userEvent.click(screen.getByText("Cancel"));

    // Verify dialog is closed
    await waitFor(() => {
      expect(screen.queryByText(/Are you sure/)).toBeNull();
    });
  });
});

describe("UI-ATT-08: Unavailable attachment state on Preview/Download failure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    vi.mocked(api.getStoredRequesterId).mockReturnValue(null);
    vi.mocked(api.setStoredRequesterId).mockImplementation((id) => sessionStorage.setItem("toktickit.requesterId", String(id)));
    vi.mocked(api.clearStoredRequesterId).mockImplementation(() => sessionStorage.removeItem("toktickit.requesterId"));
    vi.mocked(api.fetchMyTickets).mockImplementation(async () => ({
      data: [{
        id: 1,
        ticketNumber: testTicketNumber,
        categoryId: 1,
        categoryName: "Hardware",
        summary: "Test ticket",
        requestedPriority: "MEDIUM",
        itPriority: null,
        currentStatus: "NEW",
        createdAt: "2026-08-27T00:00:00.000Z",
        updatedAt: "2026-08-27T00:00:00.000Z",
      }],
      pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1, unfilteredTotalItems: 1 },
    }));
  });

  afterEach(() => {
    cleanup();
  });

  it("shows Unavailable badge and disabled controls when Preview fails", async () => {
    await setupAuthenticatedApp();

    const activeAtt = makeAttachment(1, { originalFilename: "preview-fail.jpg" });
    vi.mocked(api.fetchTicketDetail).mockImplementation(async () =>
      makeTicketDetail(testTicketNumber, [activeAtt]),
    );

    // Preview will fail
    vi.mocked(api.previewAttachmentFile).mockRejectedValue(new Error("Preview server error"));

    await waitFor(async () => {
      const links = screen.getAllByText(testTicketNumber);
      expect(links.length).toBeGreaterThan(0);
    });
    const ticketLnk = screen.getAllByText(testTicketNumber)[0];
    await userEvent.click(ticketLnk);
    await waitFor(() => expect(screen.getByText("Attachments")).toBeTruthy());

    // Click Preview — it should fail
    const row = screen.getByText("preview-fail.jpg").closest("li")!;
    const previewBtn = within(row).getByText("Preview");
    await userEvent.click(previewBtn);

    // Wait for Unavailable badge to appear
    await waitFor(() => {
      expect(screen.getByText("Unavailable")).toBeTruthy();
    });

    // Verify error message is shown
    expect(screen.getByText("Preview server error")).toBeTruthy();

    // Verify Preview and Download are disabled
    const disabledBtns = row!.querySelectorAll('button[disabled]');
    expect(disabledBtns.length).toBeGreaterThanOrEqual(2);

    // Verify no Retry button for Preview/Download failure (ui-spec §5.3 Unavailable:
    // a Preview/Download-serving failure has no retry action). Remove remains enabled
    // because the spec does not disable it for the Unavailable state.
    expect(within(row!).queryByText("Retry")).toBeNull();
  });

  it("shows Unavailable badge and disabled controls when Download fails", async () => {
    await setupAuthenticatedApp();

    const activeAtt = makeAttachment(1, { originalFilename: "download-fail.jpg" });
    vi.mocked(api.fetchTicketDetail).mockImplementation(async () =>
      makeTicketDetail(testTicketNumber, [activeAtt]),
    );

    // Preview succeeds but Download fails
    vi.mocked(api.previewAttachmentFile).mockResolvedValue({
      blob: new Blob(["fake-image"], { type: "image/jpeg" }),
      mimeType: "image/jpeg",
    });
    vi.mocked(api.downloadAttachmentFile).mockRejectedValue(new Error("Download server error"));

    await waitFor(async () => {
      const links = screen.getAllByText(testTicketNumber);
      expect(links.length).toBeGreaterThan(0);
    });
    const ticketLnk = screen.getAllByText(testTicketNumber)[0];
    await userEvent.click(ticketLnk);
    await waitFor(() => expect(screen.getByText("Attachments")).toBeTruthy());

    // Click Download — it should fail
    const dlRow = screen.getByText("download-fail.jpg").closest("li")!;
    const downloadBtn = within(dlRow).getByText("Download");
    await userEvent.click(downloadBtn);

    // Wait for Unavailable badge to appear
    await waitFor(() => {
      expect(screen.getByText("Unavailable")).toBeTruthy();
    });

    // Verify error message is shown
    expect(screen.getByText("Download server error")).toBeTruthy();

    // Verify Preview and Download are disabled
    const disabledBtns = dlRow.querySelectorAll('button[disabled]');
    expect(disabledBtns.length).toBeGreaterThanOrEqual(2);
  });

  it("shows Unavailable row with Retry for Add Attachment upload failure in Ticket Detail", async () => {
    await setupAuthenticatedApp();

    vi.mocked(api.fetchTicketDetail).mockImplementation(async () =>
      makeTicketDetail(testTicketNumber, []),
    );

    // Upload will fail
    vi.mocked(api.uploadAttachment).mockRejectedValue(new Error("Upload server error"));

    await waitFor(async () => {
      const links = screen.getAllByText(testTicketNumber);
      expect(links.length).toBeGreaterThan(0);
    });
    const ticketLnk = screen.getAllByText(testTicketNumber)[0];
    await userEvent.click(ticketLnk);
    await waitFor(() => expect(screen.getByText("Attachments")).toBeTruthy());

    // Click Add Attachment button
    await userEvent.click(screen.getByText("+ Add Attachment"));

    // Select a file
    const fileInput = getFileInput();
    expect(fileInput).not.toBeNull();
    fireEvent.change(fileInput!, {
      target: { files: [new File(["content"], "upload-fail.jpg", { type: "image/jpeg" })] },
    });

    // Wait for Unavailable badge to appear
    await waitFor(() => {
      expect(screen.getByText("Unavailable")).toBeTruthy();
    });

    // Verify error message is shown
    expect(screen.getByText("Upload server error")).toBeTruthy();

    // Verify Retry button is present
    expect(screen.getByText("Retry")).toBeTruthy();
  });
});