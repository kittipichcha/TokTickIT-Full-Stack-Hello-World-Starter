import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

async function setupAuthenticatedApp() {
  vi.mocked(api.fetchDevRequesters).mockImplementation(async () => requesters);
  vi.mocked(api.fetchRequesterContext).mockImplementation(async () => ({ requesterId: 1 }));
  vi.mocked(api.fetchCategories).mockImplementation(async () => categories);
  vi.mocked(api.fetchRelatedSystems).mockImplementation(async () => relatedSystems);
  vi.mocked(api.fetchMyTickets).mockImplementation(async () => ({
    data: [],
    pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0, unfilteredTotalItems: 0 },
  }));

  render(<App />);

  // Wait for requester selector to load and select a requester
  await userEvent.selectOptions(await screen.findByRole("combobox", { name: /development requester/i }), "1");
  await userEvent.click(screen.getByRole("button", { name: "Continue" }));

  // Wait for app shell to appear — look for the Ada Lovelace text
  await screen.findAllByText(/Ada Lovelace/);
}

describe("UI-TKT-01: Empty summary blocks submit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    vi.mocked(api.getStoredRequesterId).mockReturnValue(null);
    vi.mocked(api.setStoredRequesterId).mockImplementation((id) => sessionStorage.setItem("toktickit.requesterId", String(id)));
    vi.mocked(api.clearStoredRequesterId).mockImplementation(() => sessionStorage.removeItem("toktickit.requesterId"));
  });

  afterEach(() => {
    cleanup();
  });

  it("shows field error and does not send API call when summary is empty", async () => {
    await setupAuthenticatedApp();

    // Navigate to Create Ticket
    await userEvent.click(screen.getByRole("link", { name: "Create Ticket" }));

    // Wait for form to load
    await screen.findByLabelText(/Summary/);

    // Fill in valid fields except summary
    await userEvent.selectOptions(screen.getByLabelText(/Category/), "1");
    await userEvent.selectOptions(screen.getByLabelText(/Related System/), "1");
    await userEvent.type(screen.getByLabelText(/Description/), "Valid description text for testing");

    // Submit with empty summary
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    // Should show field error
    expect(screen.getByText("Summary is required.")).toBeTruthy();
    expect(api.createTicket).not.toHaveBeenCalled();
  });
});

describe("UI-TKT-02: Summary over 120 chars blocks submit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    vi.mocked(api.getStoredRequesterId).mockReturnValue(null);
    vi.mocked(api.setStoredRequesterId).mockImplementation((id) => sessionStorage.setItem("toktickit.requesterId", String(id)));
    vi.mocked(api.clearStoredRequesterId).mockImplementation(() => sessionStorage.removeItem("toktickit.requesterId"));
  });

  afterEach(() => {
    cleanup();
  });

  it("shows length error when summary exceeds 120 characters", async () => {
    await setupAuthenticatedApp();
    await userEvent.click(screen.getByRole("link", { name: "Create Ticket" }));
    await screen.findByLabelText(/Summary/);

    await userEvent.selectOptions(screen.getByLabelText(/Category/), "1");
    await userEvent.selectOptions(screen.getByLabelText(/Related System/), "1");
    await userEvent.type(screen.getByLabelText(/Summary/), "a".repeat(121));
    await userEvent.type(screen.getByLabelText(/Description/), "Valid description text for testing");

    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(screen.getByText("Summary must be at most 120 characters.")).toBeTruthy();
    expect(api.createTicket).not.toHaveBeenCalled();
  });
});

describe("UI-TKT-03: Description under 10 chars blocks submit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    vi.mocked(api.getStoredRequesterId).mockReturnValue(null);
    vi.mocked(api.setStoredRequesterId).mockImplementation((id) => sessionStorage.setItem("toktickit.requesterId", String(id)));
    vi.mocked(api.clearStoredRequesterId).mockImplementation(() => sessionStorage.removeItem("toktickit.requesterId"));
  });

  afterEach(() => {
    cleanup();
  });

  it("shows field error when description is too short", async () => {
    await setupAuthenticatedApp();
    await userEvent.click(screen.getByRole("link", { name: "Create Ticket" }));
    await screen.findByLabelText(/Summary/);

    await userEvent.selectOptions(screen.getByLabelText(/Category/), "1");
    await userEvent.selectOptions(screen.getByLabelText(/Related System/), "1");
    await userEvent.type(screen.getByLabelText(/Summary/), "Valid summary");
    await userEvent.type(screen.getByLabelText(/Description/), "short");

    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(screen.getByText("Description must be at least 10 characters.")).toBeTruthy();
    expect(api.createTicket).not.toHaveBeenCalled();
  });
});

describe("UI-TKT-04: Submit busy state prevents duplicate submission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    vi.mocked(api.getStoredRequesterId).mockReturnValue(null);
    vi.mocked(api.setStoredRequesterId).mockImplementation((id) => sessionStorage.setItem("toktickit.requesterId", String(id)));
    vi.mocked(api.clearStoredRequesterId).mockImplementation(() => sessionStorage.removeItem("toktickit.requesterId"));
  });

  afterEach(() => {
    cleanup();
  });

  it("disables submit button and shows Submitting… while request is in flight", async () => {
    // Make createTicket hang
    vi.mocked(api.createTicket).mockReturnValue(new Promise(() => undefined));

    await setupAuthenticatedApp();
    await userEvent.click(screen.getByRole("link", { name: "Create Ticket" }));
    await screen.findByLabelText(/Summary/);

    await userEvent.selectOptions(screen.getByLabelText(/Category/), "1");
    await userEvent.selectOptions(screen.getByLabelText(/Related System/), "1");
    await userEvent.type(screen.getByLabelText(/Summary/), "Valid summary text");
    await userEvent.type(screen.getByLabelText(/Description/), "Valid description text for testing");

    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    // Button should show busy state
    const submitButton = screen.getByRole("button", { name: "Submitting…" });
    expect((submitButton as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("UI-TKT-05: Case A — failed create preserves form and shows inline error", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    vi.mocked(api.getStoredRequesterId).mockReturnValue(null);
    vi.mocked(api.setStoredRequesterId).mockImplementation((id) => sessionStorage.setItem("toktickit.requesterId", String(id)));
    vi.mocked(api.clearStoredRequesterId).mockImplementation(() => sessionStorage.removeItem("toktickit.requesterId"));
  });

  afterEach(() => {
    cleanup();
  });

  it("preserves form values and shows error on API failure", async () => {
    vi.mocked(api.createTicket).mockRejectedValue(new Error("Server error"));

    await setupAuthenticatedApp();
    await userEvent.click(screen.getByRole("link", { name: "Create Ticket" }));
    await screen.findByLabelText(/Summary/);

    await userEvent.selectOptions(screen.getByLabelText(/Category/), "1");
    await userEvent.selectOptions(screen.getByLabelText(/Related System/), "1");
    await userEvent.type(screen.getByLabelText(/Summary/), "My laptop battery issue");
    await userEvent.type(screen.getByLabelText(/Description/), "The battery drains very quickly after the update");

    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    // Wait for error to appear
    await screen.findByRole("alert");

    // Form values should be preserved
    expect((screen.getByLabelText(/Summary/) as HTMLInputElement).value).toBe("My laptop battery issue");
    expect((screen.getByLabelText(/Description/) as HTMLTextAreaElement).value).toBe("The battery drains very quickly after the update");

    // Submit should be re-enabled for manual retry
    expect(screen.getByRole("button", { name: "Submit" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "Submit" }) as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("UI-TKT-07: Requested Priority defaults to MEDIUM", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    vi.mocked(api.getStoredRequesterId).mockReturnValue(null);
    vi.mocked(api.setStoredRequesterId).mockImplementation((id) => sessionStorage.setItem("toktickit.requesterId", String(id)));
    vi.mocked(api.clearStoredRequesterId).mockImplementation(() => sessionStorage.removeItem("toktickit.requesterId"));
  });

  afterEach(() => {
    cleanup();
  });

  it("defaults requested priority to MEDIUM", async () => {
    await setupAuthenticatedApp();
    await userEvent.click(screen.getByRole("link", { name: "Create Ticket" }));
    await screen.findByLabelText(/Summary/);

    const prioritySelect = screen.getByLabelText(/Requested Priority/) as HTMLSelectElement;
    expect(prioritySelect.value).toBe("MEDIUM");
  });
});

describe("UI-ERR-01: Case A — ticket create API failure preserves form state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    vi.mocked(api.getStoredRequesterId).mockReturnValue(null);
    vi.mocked(api.setStoredRequesterId).mockImplementation((id) => sessionStorage.setItem("toktickit.requesterId", String(id)));
    vi.mocked(api.clearStoredRequesterId).mockImplementation(() => sessionStorage.removeItem("toktickit.requesterId"));
  });

  afterEach(() => {
    cleanup();
  });

  it("requires manual retry after failure", async () => {
    vi.mocked(api.createTicket).mockRejectedValue(new Error("Network error"));

    await setupAuthenticatedApp();
    await userEvent.click(screen.getByRole("link", { name: "Create Ticket" }));
    await screen.findByLabelText(/Summary/);

    await userEvent.selectOptions(screen.getByLabelText(/Category/), "1");
    await userEvent.selectOptions(screen.getByLabelText(/Related System/), "1");
    await userEvent.type(screen.getByLabelText(/Summary/), "Test summary here");
    await userEvent.type(screen.getByLabelText(/Description/), "Test description with enough chars");

    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    // Wait for error
    await screen.findByRole("alert");

    // Submit should be available for manual retry
    const submitButton = screen.getByRole("button", { name: "Submit" });
    expect((submitButton as HTMLButtonElement).disabled).toBe(false);

    // Should only have been called once (no auto-retry)
    expect(api.createTicket).toHaveBeenCalledTimes(1);
  });
});

describe("UI-TKT-SUCCESS: Success flow — Ticket Number display, date formatting, and View Ticket navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    vi.mocked(api.getStoredRequesterId).mockReturnValue(null);
    vi.mocked(api.setStoredRequesterId).mockImplementation((id) => sessionStorage.setItem("toktickit.requesterId", String(id)));
    vi.mocked(api.clearStoredRequesterId).mockImplementation(() => sessionStorage.removeItem("toktickit.requesterId"));
  });

  afterEach(() => {
    cleanup();
  });

  it("displays generated Ticket Number from API response after successful creation", async () => {
    vi.mocked(api.createTicket).mockResolvedValue({
      id: 501,
      ticketNumber: "TKT-2026-000123",
      requesterId: 1,
      categoryId: 1,
      relatedSystemId: 1,
      summary: "My laptop battery issue",
      description: "The battery drains very quickly after the update",
      requestedPriority: "MEDIUM",
      itPriority: null,
      ticketOwnerId: null,
      currentStatus: "NEW",
      createdAt: "2026-08-21T09:14:00.000Z",
      updatedAt: "2026-08-21T09:14:00.000Z",
    });

    await setupAuthenticatedApp();
    await userEvent.click(screen.getByRole("link", { name: "Create Ticket" }));
    await screen.findByLabelText(/Summary/);

    await userEvent.selectOptions(screen.getByLabelText(/Category/), "1");
    await userEvent.selectOptions(screen.getByLabelText(/Related System/), "1");
    await userEvent.type(screen.getByLabelText(/Summary/), "My laptop battery issue");
    await userEvent.type(screen.getByLabelText(/Description/), "The battery drains very quickly after the update");

    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    // Success panel should show the ticket number
    await screen.findByText("Ticket Created");
    expect(screen.getByText("TKT-2026-000123")).toBeTruthy();
  });

  it("displays Ticket Date in UTC format YYYY-MM-DD HH:mm:ss UTC after success", async () => {
    vi.mocked(api.createTicket).mockResolvedValue({
      id: 501,
      ticketNumber: "TKT-2026-000123",
      requesterId: 1,
      categoryId: 1,
      relatedSystemId: 1,
      summary: "My laptop battery issue",
      description: "The battery drains very quickly after the update",
      requestedPriority: "MEDIUM",
      itPriority: null,
      ticketOwnerId: null,
      currentStatus: "NEW",
      createdAt: "2026-08-21T09:14:00.000Z",
      updatedAt: "2026-08-21T09:14:00.000Z",
    });

    await setupAuthenticatedApp();
    await userEvent.click(screen.getByRole("link", { name: "Create Ticket" }));
    await screen.findByLabelText(/Summary/);

    await userEvent.selectOptions(screen.getByLabelText(/Category/), "1");
    await userEvent.selectOptions(screen.getByLabelText(/Related System/), "1");
    await userEvent.type(screen.getByLabelText(/Summary/), "My laptop battery issue");
    await userEvent.type(screen.getByLabelText(/Description/), "The battery drains very quickly after the update");

    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    // Success panel should show the formatted date
    await screen.findByText("Ticket Created");
    expect(screen.getByText("2026-08-21 09:14:00 UTC")).toBeTruthy();
  });

  it("View Ticket button navigates to ticket detail view", async () => {
    vi.mocked(api.createTicket).mockResolvedValue({
      id: 501,
      ticketNumber: "TKT-2026-000123",
      requesterId: 1,
      categoryId: 1,
      relatedSystemId: 1,
      summary: "My laptop battery issue",
      description: "The battery drains very quickly after the update",
      requestedPriority: "MEDIUM",
      itPriority: null,
      ticketOwnerId: null,
      currentStatus: "NEW",
      createdAt: "2026-08-21T09:14:00.000Z",
      updatedAt: "2026-08-21T09:14:00.000Z",
    });

    // Mock ticket detail fetch for the detail view
    vi.mocked(api.fetchTicketDetail).mockResolvedValue({
      id: 501,
      ticketNumber: "TKT-2026-000123",
      requesterId: 1,
      requesterName: "Ada Lovelace",
      requesterIsActive: true,
      categoryId: 1,
      categoryName: "Hardware",
      relatedSystemId: 1,
      relatedSystemName: "Corporate Laptop",
      summary: "My laptop battery issue",
      description: "The battery drains very quickly after the update",
      requestedPriority: "MEDIUM",
      itPriority: null,
      ticketOwnerId: null,
      currentStatus: "NEW",
      createdAt: "2026-08-21T09:14:00.000Z",
      updatedAt: "2026-08-21T09:14:00.000Z",
      attachments: [],
    });

    await setupAuthenticatedApp();
    await userEvent.click(screen.getByRole("link", { name: "Create Ticket" }));
    await screen.findByLabelText(/Summary/);

    await userEvent.selectOptions(screen.getByLabelText(/Category/), "1");
    await userEvent.selectOptions(screen.getByLabelText(/Related System/), "1");
    await userEvent.type(screen.getByLabelText(/Summary/), "My laptop battery issue");
    await userEvent.type(screen.getByLabelText(/Description/), "The battery drains very quickly after the update");

    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    // Success panel should appear
    await screen.findByText("Ticket Created");

    // Click View Ticket
    await userEvent.click(screen.getByRole("button", { name: "View Ticket" }));

    // Should navigate to ticket detail and show the ticket number
    await screen.findByText("TKT-2026-000123");
    expect(screen.getByText("Hardware")).toBeTruthy();
    // Ada Lovelace appears in both header and detail — verify at least one
    expect(screen.getAllByText("Ada Lovelace").length).toBeGreaterThanOrEqual(1);
  });

  it("Create Another button resets form and allows new ticket creation", async () => {
    vi.mocked(api.createTicket).mockResolvedValue({
      id: 501,
      ticketNumber: "TKT-2026-000123",
      requesterId: 1,
      categoryId: 1,
      relatedSystemId: 1,
      summary: "My laptop battery issue",
      description: "The battery drains very quickly after the update",
      requestedPriority: "MEDIUM",
      itPriority: null,
      ticketOwnerId: null,
      currentStatus: "NEW",
      createdAt: "2026-08-21T09:14:00.000Z",
      updatedAt: "2026-08-21T09:14:00.000Z",
    });

    await setupAuthenticatedApp();
    await userEvent.click(screen.getByRole("link", { name: "Create Ticket" }));
    await screen.findByLabelText(/Summary/);

    await userEvent.selectOptions(screen.getByLabelText(/Category/), "1");
    await userEvent.selectOptions(screen.getByLabelText(/Related System/), "1");
    await userEvent.type(screen.getByLabelText(/Summary/), "My laptop battery issue");
    await userEvent.type(screen.getByLabelText(/Description/), "The battery drains very quickly after the update");

    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    // Success panel should appear
    await screen.findByText("Ticket Created");

    // Click Create Another
    await userEvent.click(screen.getByRole("button", { name: "Create Another" }));

    // Should be back on the create ticket form with reset fields
    await screen.findByLabelText(/Summary/);
    expect((screen.getByLabelText(/Summary/) as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText(/Description/) as HTMLTextAreaElement).value).toBe("");
    expect((screen.getByLabelText(/Requested Priority/) as HTMLSelectElement).value).toBe("MEDIUM");
  });
});

describe("UI-TKT-CAP-01: Create Ticket five-active-attachment capacity", () => {
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
  });

  afterEach(() => {
    cleanup();
  });

  function getFileInput(): HTMLInputElement | null {
    const inputs = document.querySelectorAll<HTMLInputElement>('input[type="file"]');
    return inputs.length > 0 ? inputs[inputs.length - 1] : null;
  }

  it("accepts exactly five valid attachments and displays 5/5", async () => {
    await setupAuthenticatedApp();
    await userEvent.click(screen.getByRole("link", { name: "Create Ticket" }));
    await screen.findByLabelText(/Summary/);

    const fileInput = getFileInput();
    expect(fileInput).not.toBeNull();

    const files = Array.from({ length: 5 }, (_, i) =>
      new File([`content-${i}`], `file-${i}.jpg`, { type: "image/jpeg" }),
    );
    fireEvent.change(fileInput!, { target: { files } });

    expect(screen.getByText("(5/5)")).toBeTruthy();
    for (let i = 0; i < 5; i++) {
      expect(screen.getByText(`file-${i}.jpg`)).toBeTruthy();
    }
  });

  it("rejects a sixth valid file — it cannot enter the upload set", async () => {
    await setupAuthenticatedApp();
    await userEvent.click(screen.getByRole("link", { name: "Create Ticket" }));
    await screen.findByLabelText(/Summary/);

    const fileInput = getFileInput();
    expect(fileInput).not.toBeNull();

    const files = Array.from({ length: 6 }, (_, i) =>
      new File([`content-${i}`], `file-${i}.jpg`, { type: "image/jpeg" }),
    );
    fireEvent.change(fileInput!, { target: { files } });

    // Only 5 valid files may be accepted; the sixth is rejected with an error.
    expect(screen.getByText("(5/5)")).toBeTruthy();
    expect(screen.getAllByText(/maximum number of active attachments/).length).toBeGreaterThanOrEqual(1);
  });

  it("excludes invalid files from the upload set while keeping valid ones", async () => {
    await setupAuthenticatedApp();
    await userEvent.click(screen.getByRole("link", { name: "Create Ticket" }));
    await screen.findByLabelText(/Summary/);

    const fileInput = getFileInput();
    expect(fileInput).not.toBeNull();

    fireEvent.change(fileInput!, {
      target: {
        files: [
          new File(["content"], "valid.jpg", { type: "image/jpeg" }),
          new File(["content"], "bad.txt", { type: "text/plain" }),
        ],
      },
    });

    expect(screen.getByText("valid.jpg")).toBeTruthy();
    expect(screen.getByText("bad.txt")).toBeTruthy();
    expect(screen.getByText(/not supported/)).toBeTruthy();
    // Only the valid file counts toward the capacity.
    expect(screen.getByText("(1/5)")).toBeTruthy();
  });

  it("removing a selected file frees a slot", async () => {
    await setupAuthenticatedApp();
    await userEvent.click(screen.getByRole("link", { name: "Create Ticket" }));
    await screen.findByLabelText(/Summary/);

    const fileInput = getFileInput();
    expect(fileInput).not.toBeNull();

    const files = Array.from({ length: 5 }, (_, i) =>
      new File([`content-${i}`], `file-${i}.jpg`, { type: "image/jpeg" }),
    );
    fireEvent.change(fileInput!, { target: { files } });
    expect(screen.getByText("(5/5)")).toBeTruthy();

    // Remove one file.
    await userEvent.click(screen.getByRole("button", { name: "Remove file-0.jpg" }));
    expect(screen.getByText("(4/5)")).toBeTruthy();
    expect(screen.queryByText("file-0.jpg")).toBeNull();
  });

  it("never submits the excluded sixth file to the upload API", async () => {
    vi.mocked(api.createTicket).mockResolvedValue({
      id: 1,
      ticketNumber: "TKT-2026-000001",
      requesterId: 1,
      categoryId: 1,
      relatedSystemId: 1,
      summary: "Capacity test",
      description: "Testing that the sixth file is never uploaded.",
      requestedPriority: "MEDIUM",
      itPriority: null,
      ticketOwnerId: null,
      currentStatus: "NEW",
      createdAt: "2026-08-27T00:00:00.000Z",
      updatedAt: "2026-08-27T00:00:00.000Z",
    });
    vi.mocked(api.uploadAttachment).mockResolvedValue({
      id: 1,
      ticketId: 1,
      originalFilename: "file-0.jpg",
      mimeType: "image/jpeg",
      fileSizeBytes: 10,
      uploadedAt: "2026-08-27T00:00:00.000Z",
      isRemoved: false,
    });

    await setupAuthenticatedApp();
    await userEvent.click(screen.getByRole("link", { name: "Create Ticket" }));
    await screen.findByLabelText(/Summary/);

    await userEvent.selectOptions(screen.getByLabelText(/Category/), "1");
    await userEvent.selectOptions(screen.getByLabelText(/Related System/), "1");
    await userEvent.type(screen.getByLabelText(/Summary/), "Capacity test scenario");
    await userEvent.type(screen.getByLabelText(/Description/), "Testing that the sixth file is never uploaded.");

    const fileInput = getFileInput();
    expect(fileInput).not.toBeNull();

    const files = Array.from({ length: 6 }, (_, i) =>
      new File([`content-${i}`], `file-${i}.jpg`, { type: "image/jpeg" }),
    );
    fireEvent.change(fileInput!, { target: { files } });

    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(screen.getByText(/Ticket Created/)).toBeTruthy();
    });

    // Only 5 uploads may be attempted — the sixth file is excluded.
    expect(api.uploadAttachment).toHaveBeenCalledTimes(5);
  });
});

describe("UI-TKT-08: Valid + invalid pre-submit attachments submit the ticket with only the valid file", () => {
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
  });

  afterEach(() => {
    cleanup();
  });

  function getFileInput(): HTMLInputElement | null {
    const inputs = document.querySelectorAll<HTMLInputElement>('input[type="file"]');
    return inputs.length > 0 ? inputs[inputs.length - 1] : null;
  }

  it("submits the ticket once and uploads only the valid file, never the invalid one", async () => {
    vi.mocked(api.createTicket).mockResolvedValue({
      id: 501,
      ticketNumber: "TKT-2026-000123",
      requesterId: 1,
      categoryId: 1,
      relatedSystemId: 1,
      summary: "Mixed attachment submission",
      description: "One valid and one invalid file are selected before submit.",
      requestedPriority: "MEDIUM",
      itPriority: null,
      ticketOwnerId: null,
      currentStatus: "NEW",
      createdAt: "2026-08-21T09:14:00.000Z",
      updatedAt: "2026-08-21T09:14:00.000Z",
    });
    vi.mocked(api.uploadAttachment).mockResolvedValue({
      id: 1,
      ticketId: 501,
      originalFilename: "valid.jpg",
      mimeType: "image/jpeg",
      fileSizeBytes: 10,
      uploadedAt: "2026-08-21T09:14:00.000Z",
      isRemoved: false,
    });

    await setupAuthenticatedApp();
    await userEvent.click(screen.getByRole("link", { name: "Create Ticket" }));
    await screen.findByLabelText(/Summary/);

    await userEvent.selectOptions(screen.getByLabelText(/Category/), "1");
    await userEvent.selectOptions(screen.getByLabelText(/Related System/), "1");
    await userEvent.type(screen.getByLabelText(/Summary/), "Mixed attachment submission");
    await userEvent.type(screen.getByLabelText(/Description/), "One valid and one invalid file are selected before submit.");

    const fileInput = getFileInput();
    expect(fileInput).not.toBeNull();

    // Arrange: one valid + one invalid file.
    fireEvent.change(fileInput!, {
      target: {
        files: [
          new File(["content"], "valid.jpg", { type: "image/jpeg" }),
          new File(["content"], "invalid.txt", { type: "text/plain" }),
        ],
      },
    });

    // 1. The invalid file is visibly rejected.
    expect(screen.getByText("invalid.txt")).toBeTruthy();
    expect(screen.getByText(/not supported/)).toBeTruthy();
    // 2. The valid file remains accepted.
    expect(screen.getByText("valid.jpg")).toBeTruthy();
    // Only the valid file counts toward capacity.
    expect(screen.getByText("(1/5)")).toBeTruthy();

    // 3. Submit the form.
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    // 4. Success state is displayed.
    await waitFor(() => {
      expect(screen.getByText(/Ticket Created/)).toBeTruthy();
    });

    // 5. createTicket() executes exactly once.
    expect(api.createTicket).toHaveBeenCalledTimes(1);
    // 6. uploadAttachment() executes exactly once.
    expect(api.uploadAttachment).toHaveBeenCalledTimes(1);
    // 7. Its argument is the valid file.
    const uploadArg = vi.mocked(api.uploadAttachment).mock.calls[0];
    expect(uploadArg[2].name).toBe("valid.jpg");
    // 8. The invalid file is never passed to uploadAttachment().
    expect(uploadArg[2].name).not.toBe("invalid.txt");
  });
});