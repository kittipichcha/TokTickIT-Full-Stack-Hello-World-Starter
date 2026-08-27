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
  const selects = await screen.findAllByLabelText("Development Requester");
  await userEvent.selectOptions(selects[0], "1");
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