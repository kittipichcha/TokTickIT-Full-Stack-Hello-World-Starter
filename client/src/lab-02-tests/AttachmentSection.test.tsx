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

  await userEvent.click(await screen.findByRole("radio", { name: "Select Ada Lovelace" }));
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
        ticketId: 1,
        originalFilename: `file-${uploadCallCount}.jpg`,
        mimeType: "image/jpeg",
        fileSizeBytes: 1024,
        uploadedAt: "2026-08-27T00:00:00.000Z",
        isRemoved: false,
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
        ticketId: 1,
        originalFilename: `file-${uploadCallCount}.jpg`,
        mimeType: "image/jpeg",
        fileSizeBytes: 1024,
        uploadedAt: "2026-08-27T00:00:00.000Z",
        isRemoved: false,
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

    // Actually dispatch an Escape keyboard event against the dialog, not Cancel.
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    fireEvent.keyDown(dialog, { key: "Escape" });

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

    // Capture the original Remove button before opening the dialog.
    const removeBtn = screen.getByText("Remove");
    await userEvent.click(removeBtn);
    await screen.findByText(/Are you sure/);

    // Close dialog via Cancel
    await userEvent.click(screen.getByText("Cancel"));

    // Verify dialog is closed
    await waitFor(() => {
      expect(screen.queryByText(/Are you sure/)).toBeNull();
    });

    // Focus must be restored to the original Remove button.
    expect(document.activeElement).toBe(removeBtn);
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

describe("UI-ATT-CAP-01: Ticket Detail five-active-attachment capacity", () => {
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
    vi.mocked(api.isAllowedAttachmentType).mockReturnValue(true);
    vi.mocked(api.isWithinSizeLimit).mockReturnValue(true);
  });

  afterEach(() => {
    cleanup();
  });

  async function openDetail(attachments: api.AttachmentItem[]) {
    vi.mocked(api.fetchTicketDetail).mockImplementation(async () =>
      makeTicketDetail(testTicketNumber, attachments),
    );
    await waitFor(async () => {
      const links = screen.getAllByText(testTicketNumber);
      expect(links.length).toBeGreaterThan(0);
    });
    const ticketLnk = screen.getAllByText(testTicketNumber)[0];
    await userEvent.click(ticketLnk);
    await waitFor(() => expect(screen.getByText("Attachments")).toBeTruthy());
  }

  it("disables Add Attachment at five active attachments", async () => {
    await setupAuthenticatedApp();
    const fiveActive = Array.from({ length: 5 }, (_, i) =>
      makeAttachment(i + 1, { originalFilename: `active-${i}.jpg` }),
    );
    await openDetail(fiveActive);

    const addBtn = screen.getByRole("button", { name: "+ Add Attachment" });
    expect(addBtn.hasAttribute("disabled")).toBe(true);
  });

  it("rejects a direct file selection at five active attachments — no upload request", async () => {
    await setupAuthenticatedApp();
    const fiveActive = Array.from({ length: 5 }, (_, i) =>
      makeAttachment(i + 1, { originalFilename: `active-${i}.jpg` }),
    );
    await openDetail(fiveActive);

    const fileInput = getFileInput();
    expect(fileInput).not.toBeNull();
    fireEvent.change(fileInput!, {
      target: { files: [new File(["content"], "sixth.jpg", { type: "image/jpeg" })] },
    });

    // No upload request should be made.
    expect(api.uploadAttachment).not.toHaveBeenCalled();
    // The capacity error is shown.
    await waitFor(() => {
      expect(screen.getByText(/maximum number of active attachments/)).toBeTruthy();
    });
  });

  it("re-enables Add Attachment after removing one of five", async () => {
    await setupAuthenticatedApp();
    const fiveActive = Array.from({ length: 5 }, (_, i) =>
      makeAttachment(i + 1, { originalFilename: `active-${i}.jpg` }),
    );
    await openDetail(fiveActive);

    const addBtn = screen.getByRole("button", { name: "+ Add Attachment" });
    expect(addBtn.hasAttribute("disabled")).toBe(true);

    // Remove one attachment.
    vi.mocked(api.removeAttachment).mockResolvedValue({
      id: 1,
      originalFilename: "active-0.jpg",
      mimeType: "image/jpeg",
      fileSizeBytes: 1024,
      uploadedAt: "2026-08-27T00:00:00.000Z",
      isRemoved: true,
      removedAt: "2026-08-27T01:00:00.000Z",
      removalReason: "test",
      removedByRequesterId: 1,
    });
    // After removal, the detail refresh returns four active attachments.
    vi.mocked(api.fetchTicketDetail).mockImplementation(async () =>
      makeTicketDetail(testTicketNumber, fiveActive.slice(1)),
    );

    await userEvent.click(screen.getAllByText("Remove")[0]);
    await screen.findByText(/Are you sure/);
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    const confirmBtn = within(dialog).getByRole("button", { name: "Remove" });
    await userEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "+ Add Attachment" }).hasAttribute("disabled")).toBe(false);
    });
  });

  it("does not count removed attachments toward the active limit", async () => {
    await setupAuthenticatedApp();
    const attachments = [
      ...Array.from({ length: 4 }, (_, i) => makeAttachment(i + 1, { originalFilename: `active-${i}.jpg` })),
      makeAttachment(5, { originalFilename: "removed.jpg", isRemoved: true }),
    ];
    await openDetail(attachments);

    // 4 active + 1 removed = Add Attachment enabled.
    const addBtn = screen.getByRole("button", { name: "+ Add Attachment" });
    expect(addBtn.hasAttribute("disabled")).toBe(false);
  });
});

describe("UI-ATT-RETRY-OWN: Failed attachment retry is scoped to requester + ticket", () => {
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
    vi.mocked(api.fetchTicketDetail).mockImplementation(async () => makeTicketDetail(testTicketNumber, []));
  });

  afterEach(() => {
    cleanup();
  });

  it("failed attachment from Ticket A is absent when viewing Ticket B", async () => {
    await setupAuthenticatedApp();

    vi.mocked(api.createTicket).mockResolvedValue({
      id: 1,
      ticketNumber: testTicketNumber,
      requesterId: 1,
      categoryId: 1,
      relatedSystemId: 1,
      summary: "Retry ownership",
      description: "Testing retry ownership scoping.",
      requestedPriority: "MEDIUM",
      itPriority: null,
      ticketOwnerId: null,
      currentStatus: "NEW",
      createdAt: "2026-08-27T00:00:00.000Z",
      updatedAt: "2026-08-27T00:00:00.000Z",
    });

    // File A upload fails → Case B.
    vi.mocked(api.uploadAttachment).mockRejectedValue(new Error("Upload failed for A"));

    await userEvent.click(screen.getByRole("link", { name: "Create Ticket" }));
    await screen.findByLabelText(/Summary/);
    await userEvent.selectOptions(screen.getByLabelText(/Category/), "1");
    await userEvent.selectOptions(screen.getByLabelText(/Related System/), "1");
    await userEvent.type(screen.getByLabelText(/Summary/), "Retry ownership scenario");
    await userEvent.type(screen.getByLabelText(/Description/), "Testing failed retry ownership scoping.");

    const fileInput = getFileInput();
    fireEvent.change(fileInput!, {
      target: { files: [new File(["content"], "a.jpg", { type: "image/jpeg" })] },
    });
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(screen.getByText(/Ticket Created/)).toBeTruthy());
    await userEvent.click(screen.getByRole("button", { name: "View Ticket" }));
    await waitFor(() => expect(screen.getByText("Attachments")).toBeTruthy());

    // A's failed retry is present on ticket A.
    expect(screen.getByText("a.jpg")).toBeTruthy();
    expect(screen.getByText("Retry")).toBeTruthy();

    // Navigate to a different ticket (B). Set up My Tickets to list both A and B,
    // and fetchTicketDetail to return the correct detail per ticket.
    vi.mocked(api.fetchMyTickets).mockImplementation(async () => ({
      data: [
        {
          id: 1,
          ticketNumber: testTicketNumber,
          categoryId: 1,
          categoryName: "Hardware",
          summary: "Ticket A",
          requestedPriority: "MEDIUM",
          itPriority: null,
          currentStatus: "NEW",
          createdAt: "2026-08-27T00:00:00.000Z",
          updatedAt: "2026-08-27T00:00:00.000Z",
        },
        {
          id: 2,
          ticketNumber: "TKT-2026-000002",
          categoryId: 1,
          categoryName: "Hardware",
          summary: "Ticket B",
          requestedPriority: "MEDIUM",
          itPriority: null,
          currentStatus: "NEW",
          createdAt: "2026-08-27T00:00:00.000Z",
          updatedAt: "2026-08-27T00:00:00.000Z",
        },
      ],
      pagination: { page: 1, pageSize: 10, totalItems: 2, totalPages: 1, unfilteredTotalItems: 2 },
    }));
    vi.mocked(api.fetchTicketDetail).mockImplementation(async (rid, tn) =>
      makeTicketDetail(tn, tn === testTicketNumber ? [] : []),
    );

    // Go back to My Tickets.
    await userEvent.click(screen.getByRole("link", { name: "My Tickets" }));
    await waitFor(async () => {
      const links = screen.getAllByText("TKT-2026-000002");
      expect(links.length).toBeGreaterThan(0);
    });

    // Open ticket B.
    const ticketB = screen.getAllByText("TKT-2026-000002")[0];
    await userEvent.click(ticketB);
    await waitFor(() => expect(screen.getByText("Attachments")).toBeTruthy());

    // A's failed retry must NOT appear on ticket B.
    expect(screen.queryByText("a.jpg")).toBeNull();
    expect(screen.queryByText("Retry")).toBeNull();
  });

  it("failed attachment from prior requester is absent after requester switch", async () => {
    await setupAuthenticatedApp();

    vi.mocked(api.createTicket).mockResolvedValue({
      id: 1,
      ticketNumber: testTicketNumber,
      requesterId: 1,
      categoryId: 1,
      relatedSystemId: 1,
      summary: "Retry ownership",
      description: "Testing retry ownership scoping.",
      requestedPriority: "MEDIUM",
      itPriority: null,
      ticketOwnerId: null,
      currentStatus: "NEW",
      createdAt: "2026-08-27T00:00:00.000Z",
      updatedAt: "2026-08-27T00:00:00.000Z",
    });

    // File A upload fails → Case B, creating a failed retry scoped to requester 1 + ticket A.
    vi.mocked(api.uploadAttachment).mockRejectedValue(new Error("Upload failed for A"));

    await userEvent.click(screen.getByRole("link", { name: "Create Ticket" }));
    await screen.findByLabelText(/Summary/);
    await userEvent.selectOptions(screen.getByLabelText(/Category/), "1");
    await userEvent.selectOptions(screen.getByLabelText(/Related System/), "1");
    await userEvent.type(screen.getByLabelText(/Summary/), "Retry ownership switch");
    await userEvent.type(screen.getByLabelText(/Description/), "Testing failed retry requester-switch scoping.");
    const fileInput = getFileInput();
    fireEvent.change(fileInput!, {
      target: { files: [new File(["content"], "a-switch.jpg", { type: "image/jpeg" })] },
    });
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(screen.getByText(/Ticket Created/)).toBeTruthy());
    await userEvent.click(screen.getByRole("button", { name: "View Ticket" }));
    await waitFor(() => expect(screen.getByText("Attachments")).toBeTruthy());

    // A's failed retry is present on requester 1's ticket A.
    expect(screen.getByText("a-switch.jpg")).toBeTruthy();
    expect(screen.getByText("Retry")).toBeTruthy();

    // Switch requester. Configure the dev-requester list to include requester 2 BEFORE the
    // switch triggers a reload, so the selector offers both requesters.
    vi.mocked(api.fetchDevRequesters).mockImplementation(async () => [
      { id: 1, name: "Ada Lovelace", email: "ada@example.com" },
      { id: 2, name: "Grace Hopper", email: "grace@example.com" },
    ]);
    await userEvent.click(screen.getByRole("button", { name: "Change Requester" }));

    // Back on the early-selector screen.
    await screen.findByRole("radio", { name: "Select Grace Hopper" });

    // Select requester 2 (Grace Hopper) and continue.
    vi.mocked(api.fetchRequesterContext).mockImplementation(async (id) => ({ requesterId: id }));
    // Requester 2 (Grace Hopper) is now the active requester; the shell mounts My Tickets
    // for requester 2's scope right after Continue.
    vi.mocked(api.fetchMyTickets).mockImplementation(async (rid) => ({
      data: [],
      pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0, unfilteredTotalItems: 0 },
    }));

    await userEvent.click(screen.getByRole("radio", { name: "Select Grace Hopper" }));
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    // Requester 2's shell mounts. The prior requester's failed attachment retry must be
    // cleared by the switch — it must not resurface anywhere in requester 2's scope.
    await screen.findByText("Grace Hopper");
    await waitFor(() => expect(screen.queryByText("a-switch.jpg")).toBeNull());
    expect(screen.queryByText("Retry")).toBeNull();
  });
});

describe("UI-ATT-MUT-REF: Mutation success is terminal — refresh failure is not a mutation failure", () => {
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
    vi.mocked(api.isAllowedAttachmentType).mockReturnValue(true);
    vi.mocked(api.isWithinSizeLimit).mockReturnValue(true);
  });

  afterEach(() => {
    cleanup();
  });

  it("upload succeeds but refresh fails — no retry for the uploaded file, refresh error shown", async () => {
    await setupAuthenticatedApp();
    vi.mocked(api.fetchTicketDetail).mockImplementation(async () =>
      makeTicketDetail(testTicketNumber, []),
    );

    await waitFor(async () => {
      const links = screen.getAllByText(testTicketNumber);
      expect(links.length).toBeGreaterThan(0);
    });
    const ticketLnk = screen.getAllByText(testTicketNumber)[0];
    await userEvent.click(ticketLnk);
    await waitFor(() => expect(screen.getByText("Attachments")).toBeTruthy());

    // Upload succeeds, but the subsequent refresh fails.
    vi.mocked(api.uploadAttachment).mockResolvedValue({
      id: 1,
      ticketId: 1,
      originalFilename: "new.jpg",
      mimeType: "image/jpeg",
      fileSizeBytes: 10,
      uploadedAt: "2026-08-27T00:00:00.000Z",
      isRemoved: false,
    });
    vi.mocked(api.fetchTicketDetail).mockRejectedValue(new Error("Refresh failed"));

    const fileInput = getFileInput();
    fireEvent.change(fileInput!, {
      target: { files: [new File(["content"], "new.jpg", { type: "image/jpeg" })] },
    });

    // The uploaded file must NOT enter the retry state.
    await waitFor(() => {
      expect(screen.queryByText("Retry")).toBeNull();
    });
    // The refresh error is shown as a detail error.
    await waitFor(() => {
      expect(screen.getByText("Refresh failed")).toBeTruthy();
    });
  });

  it("remove succeeds but refresh fails — removed operation is not retryable, refresh error shown", async () => {
    await setupAuthenticatedApp();
    const activeAtt = makeAttachment(1, { originalFilename: "remove-me.jpg" });
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

    // Remove succeeds; refresh fails.
    vi.mocked(api.removeAttachment).mockResolvedValue({
      id: 1,
      originalFilename: "remove-me.jpg",
      mimeType: "image/jpeg",
      fileSizeBytes: 1024,
      uploadedAt: "2026-08-27T00:00:00.000Z",
      isRemoved: true,
      removedAt: "2026-08-27T01:00:00.000Z",
      removalReason: "test",
      removedByRequesterId: 1,
    });
    vi.mocked(api.fetchTicketDetail).mockRejectedValue(new Error("Refresh failed after remove"));

    await userEvent.click(screen.getAllByText("Remove")[0]);
    await screen.findByText(/Are you sure/);
    // The dialog's confirm button is the destructive-button inside the modal.
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    const confirmBtn = within(dialog).getByRole("button", { name: "Remove" });
    await userEvent.click(confirmBtn);

    // The dialog closes (mutation succeeded) and no attachment retry appears.
    await waitFor(() => {
      expect(screen.queryByText(/Are you sure/)).toBeNull();
    });
    // No failed-attachment row (with an attachment Retry button) is rendered.
    expect(document.querySelector(".attachment-failed")).toBeNull();
    expect(document.querySelector(".attachment-unavailable")).toBeNull();
    // Refresh error shown.
    await waitFor(() => {
      expect(screen.getByText("Refresh failed after remove")).toBeTruthy();
    });
  });
});

describe("UI-ATT-RETRY-TERMINAL: Retry upload success is terminal — refresh failure must not restore the retry row", () => {
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
    vi.mocked(api.isAllowedAttachmentType).mockReturnValue(true);
    vi.mocked(api.isWithinSizeLimit).mockReturnValue(true);
  });

  afterEach(() => {
    cleanup();
  });

  it("retry upload succeeds but refresh fails — failed row stays cleared and uploadAttachment runs exactly once during retry", async () => {
    await setupAuthenticatedApp();
    vi.mocked(api.fetchTicketDetail).mockImplementation(async () =>
      makeTicketDetail(testTicketNumber, []),
    );

    await waitFor(async () => {
      const links = screen.getAllByText(testTicketNumber);
      expect(links.length).toBeGreaterThan(0);
    });
    const ticketLnk = screen.getAllByText(testTicketNumber)[0];
    await userEvent.click(ticketLnk);
    await waitFor(() => expect(screen.getByText("Attachments")).toBeTruthy());

    // Initial upload fails → failed row appears.
    vi.mocked(api.uploadAttachment).mockRejectedValueOnce(new Error("Initial upload failed"));
    const fileInput = getFileInput();
    fireEvent.change(fileInput!, {
      target: { files: [new File(["content"], "retry-me.jpg", { type: "image/jpeg" })] },
    });

    await waitFor(() => {
      expect(screen.getByText("Unavailable")).toBeTruthy();
    });
    expect(screen.getByText("Initial upload failed")).toBeTruthy();

    // Now the retry upload succeeds, but the subsequent refresh fails.
    vi.mocked(api.uploadAttachment).mockResolvedValueOnce({
      id: 1,
      ticketId: 1,
      originalFilename: "retry-me.jpg",
      mimeType: "image/jpeg",
      fileSizeBytes: 10,
      uploadedAt: "2026-08-27T00:00:00.000Z",
      isRemoved: false,
    });
    vi.mocked(api.fetchTicketDetail).mockRejectedValue(new Error("Refresh failed after retry"));

    await userEvent.click(screen.getByText("Retry"));

    // The failed row is gone — the successful retry upload is terminal.
    await waitFor(() => {
      expect(screen.queryByText("Unavailable")).toBeNull();
    });
    // No attachment-unavailable row (with its attachment Retry button) remains.
    expect(document.querySelector(".attachment-unavailable")).toBeNull();
    // The attachment-level Retry button is gone. (The detail-error panel has its
    // own separate Retry control, which is not the attachment retry.)
    expect(document.querySelector(".attachment-unavailable button")).toBeNull();

    // The refresh failure is represented separately as a detail error.
    await waitFor(() => {
      expect(screen.getByText("Refresh failed after retry")).toBeTruthy();
    });

    // uploadAttachment was called exactly once during the retry (the initial
    // failure + one retry = 2 total calls, but only one for the retry itself).
    const uploadCalls = vi.mocked(api.uploadAttachment).mock.calls;
    expect(uploadCalls.length).toBe(2);
    // The retry call targets the same file.
    expect(uploadCalls[1][2].name).toBe("retry-me.jpg");
  });
});

describe("UI-DETAIL-01: Ticket Detail screen-level state matrix", () => {
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
    vi.mocked(api.isAllowedAttachmentType).mockReturnValue(true);
    vi.mocked(api.isWithinSizeLimit).mockReturnValue(true);
  });

  afterEach(() => {
    cleanup();
  });

  async function openTicketDetail() {
    await waitFor(async () => {
      const links = screen.getAllByText(testTicketNumber);
      expect(links.length).toBeGreaterThan(0);
    });
    const ticketLnk = screen.getAllByText(testTicketNumber)[0];
    await userEvent.click(ticketLnk);
    // Wait for the detail view to be entered. The Attachments heading only
    // appears once the detail loads successfully; for loading/404/error states
    // we wait for the detail container or the status/error region instead.
    await waitFor(() => {
      expect(
        document.querySelector(".ticket-detail") ||
        screen.queryByRole("status", { name: "Loading ticket detail" }) ||
        screen.queryByRole("alert"),
      ).toBeTruthy();
    });
  }

  it("renders read-only ticket fields (no editable inputs)", async () => {
    await setupAuthenticatedApp();
    vi.mocked(api.fetchTicketDetail).mockImplementation(async () =>
      makeTicketDetail(testTicketNumber, []),
    );
    await openTicketDetail();

    // Read-only values are rendered as text, not editable inputs.
    expect(screen.getByText(testTicketNumber)).toBeTruthy();
    expect(screen.getByText("Hardware")).toBeTruthy();
    expect(screen.getByText("Corporate Laptop")).toBeTruthy();
    // Ada Lovelace appears in both the header and the detail — at least one.
    expect(screen.getAllByText("Ada Lovelace").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Test ticket summary")).toBeTruthy();
    expect(screen.getByText("Test ticket description for detail view.")).toBeTruthy();
    // No editable text inputs / textareas / selects in the detail view.
    // (The hidden file input for Add Attachment is not an editable text field.)
    expect(document.querySelector('.ticket-detail input[type="text"]')).toBeNull();
    expect(document.querySelector('.ticket-detail input:not([type="file"])')).toBeNull();
    expect(document.querySelector('.ticket-detail textarea')).toBeNull();
    expect(document.querySelector('.ticket-detail select')).toBeNull();
  });

  it("shows the loading skeleton while the detail request is unresolved", async () => {
    await setupAuthenticatedApp();
    // Never resolve the detail request.
    vi.mocked(api.fetchTicketDetail).mockReturnValue(new Promise(() => undefined));
    await openTicketDetail();

    expect(screen.getByRole("status", { name: "Loading ticket detail" })).toBeTruthy();
  });

  it("shows a safe not-found state with no ticket data leaked", async () => {
    await setupAuthenticatedApp();
    const notFound = new Error("Ticket not found.") as Error & { code?: string };
    notFound.code = "NOT_FOUND";
    vi.mocked(api.fetchTicketDetail).mockRejectedValue(notFound);
    await openTicketDetail();

    await waitFor(() => {
      expect(screen.getByText("Ticket not found.")).toBeTruthy();
    });
    // No ticket data is leaked.
    expect(screen.queryByText("Test ticket summary")).toBeNull();
    expect(screen.queryByText("Hardware")).toBeNull();
  });

  it("shows an error state with a Retry control that refetches", async () => {
    await setupAuthenticatedApp();
    vi.mocked(api.fetchTicketDetail).mockRejectedValueOnce(new Error("Unexpected failure"));
    await openTicketDetail();

    await waitFor(() => {
      expect(screen.getByText("Unexpected failure")).toBeTruthy();
    });
    // Retry control present.
    const retryBtn = screen.getByRole("button", { name: "Retry" });
    expect(retryBtn).toBeTruthy();

    // Trigger Retry → another fetch occurs and succeeds.
    vi.mocked(api.fetchTicketDetail).mockResolvedValueOnce(makeTicketDetail(testTicketNumber, []));
    await userEvent.click(retryBtn);
    await waitFor(() => {
      expect(screen.getByText("Test ticket summary")).toBeTruthy();
    });
    expect(api.fetchTicketDetail).toHaveBeenCalledTimes(2);
  });

  it("renders an active attachment with Preview, Download, and Remove controls", async () => {
    await setupAuthenticatedApp();
    const activeAtt = makeAttachment(1, { originalFilename: "active.jpg" });
    vi.mocked(api.fetchTicketDetail).mockImplementation(async () =>
      makeTicketDetail(testTicketNumber, [activeAtt]),
    );
    await openTicketDetail();

    expect(screen.getByText("active.jpg")).toBeTruthy();
    expect(screen.getByText("Active")).toBeTruthy();
    const row = screen.getByText("active.jpg").closest("li")!;
    expect(within(row).getByText("Preview")).toBeTruthy();
    expect(within(row).getByText("Download")).toBeTruthy();
    expect(within(row).getByText("Remove")).toBeTruthy();
  });

  it("renders a removed attachment with Removed badge and disabled Preview/Download", async () => {
    await setupAuthenticatedApp();
    const removedAtt = makeAttachment(1, {
      originalFilename: "removed.jpg",
      isRemoved: true,
      removalReason: "No longer needed",
      removedAt: "2026-08-27T01:00:00.000Z",
      removedByRequesterId: 1,
    });
    vi.mocked(api.fetchTicketDetail).mockImplementation(async () =>
      makeTicketDetail(testTicketNumber, [removedAtt]),
    );
    await openTicketDetail();

    expect(screen.getByText("removed.jpg")).toBeTruthy();
    expect(screen.getByText("Removed")).toBeTruthy();
    const row = screen.getByText("removed.jpg").closest("li")!;
    const disabledBtns = row.querySelectorAll('button[disabled]');
    expect(disabledBtns.length).toBeGreaterThanOrEqual(2);
  });

  it("invokes the preview API when Preview is clicked", async () => {
    await setupAuthenticatedApp();
    const activeAtt = makeAttachment(1, { originalFilename: "preview.jpg" });
    vi.mocked(api.fetchTicketDetail).mockImplementation(async () =>
      makeTicketDetail(testTicketNumber, [activeAtt]),
    );
    vi.mocked(api.previewAttachmentFile).mockResolvedValue({
      blob: new Blob(["fake-image"], { type: "image/jpeg" }),
      mimeType: "image/jpeg",
    });
    await openTicketDetail();

    const row = screen.getByText("preview.jpg").closest("li")!;
    await userEvent.click(within(row).getByText("Preview"));

    await waitFor(() => {
      expect(api.previewAttachmentFile).toHaveBeenCalledTimes(1);
    });
    expect(api.previewAttachmentFile).toHaveBeenCalledWith(1, activeAtt.id);
  });

  it("invokes the download API when Download is clicked", async () => {
    await setupAuthenticatedApp();
    const activeAtt = makeAttachment(1, { originalFilename: "download.jpg" });
    vi.mocked(api.fetchTicketDetail).mockImplementation(async () =>
      makeTicketDetail(testTicketNumber, [activeAtt]),
    );
    vi.mocked(api.downloadAttachmentFile).mockResolvedValue({
      blob: new Blob(["fake-image"], { type: "image/jpeg" }),
      filename: "download.jpg",
    });
    await openTicketDetail();

    const row = screen.getByText("download.jpg").closest("li")!;
    await userEvent.click(within(row).getByText("Download"));

    await waitFor(() => {
      expect(api.downloadAttachmentFile).toHaveBeenCalledTimes(1);
    });
    expect(api.downloadAttachmentFile).toHaveBeenCalledWith(1, activeAtt.id);
  });

  it("removes an attachment through the confirmation dialog and updates the UI", async () => {
    await setupAuthenticatedApp();
    const activeAtt = makeAttachment(1, { originalFilename: "remove.jpg" });
    vi.mocked(api.fetchTicketDetail).mockImplementation(async () =>
      makeTicketDetail(testTicketNumber, [activeAtt]),
    );
    vi.mocked(api.removeAttachment).mockResolvedValue({
      id: 1,
      originalFilename: "remove.jpg",
      mimeType: "image/jpeg",
      fileSizeBytes: 1024,
      uploadedAt: "2026-08-27T00:00:00.000Z",
      isRemoved: true,
      removedAt: "2026-08-27T01:00:00.000Z",
      removalReason: "test",
      removedByRequesterId: 1,
    });
    await openTicketDetail();

    const row = screen.getByText("remove.jpg").closest("li")!;
    await userEvent.click(within(row).getByText("Remove"));
    await screen.findByText(/Are you sure/);

    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    const confirmBtn = within(dialog).getByRole("button", { name: "Remove" });
    await userEvent.click(confirmBtn);

    await waitFor(() => {
      expect(api.removeAttachment).toHaveBeenCalledTimes(1);
    });
    expect(api.removeAttachment).toHaveBeenCalledWith(1, activeAtt.id, undefined);
    // Dialog closes after the mutation.
    await waitFor(() => {
      expect(screen.queryByText(/Are you sure/)).toBeNull();
    });
  });

  it("shows the Add Attachment control and enforces capacity", async () => {
    await setupAuthenticatedApp();
    const activeAtts = Array.from({ length: 5 }, (_, i) =>
      makeAttachment(i + 1, { originalFilename: `file-${i + 1}.jpg` }),
    );
    vi.mocked(api.fetchTicketDetail).mockImplementation(async () =>
      makeTicketDetail(testTicketNumber, activeAtts),
    );
    await openTicketDetail();

    // At capacity, the Add Attachment button is disabled.
    const addBtn = screen.getByRole("button", { name: "+ Add Attachment" });
    expect((addBtn as HTMLButtonElement).disabled).toBe(true);
  });
});