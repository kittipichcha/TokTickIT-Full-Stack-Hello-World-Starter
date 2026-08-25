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
  vi.mocked(api.fetchDevRequesters).mockResolvedValue(requesters);
  vi.mocked(api.fetchRequesterContext).mockResolvedValue({ requesterId: 1 });
  vi.mocked(api.fetchCategories).mockResolvedValue(categories);
  vi.mocked(api.fetchRelatedSystems).mockResolvedValue(relatedSystems);

  render(<App />);

  // Wait for requester selector to load and select a requester
  const select = await screen.findByLabelText("Development Requester");
  await userEvent.selectOptions(select, "1");
  await userEvent.click(screen.getByRole("button", { name: "Continue" }));

  // Wait for app shell to appear
  await screen.findByText("Welcome, Ada Lovelace");
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
    await userEvent.click(screen.getByText("Create Ticket"));

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
    await userEvent.click(screen.getByText("Create Ticket"));
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
    await userEvent.click(screen.getByText("Create Ticket"));
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
    await userEvent.click(screen.getByText("Create Ticket"));
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
    await userEvent.click(screen.getByText("Create Ticket"));
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
    await userEvent.click(screen.getByText("Create Ticket"));
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
    await userEvent.click(screen.getByText("Create Ticket"));
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