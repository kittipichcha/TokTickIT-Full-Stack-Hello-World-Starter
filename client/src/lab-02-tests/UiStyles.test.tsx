import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";
import * as api from "../api";
import appCss from "../App.css?raw";

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

  await userEvent.selectOptions(await screen.findByRole("combobox", { name: /development requester/i }), "1");
  await userEvent.click(screen.getByRole("button", { name: "Continue" }));
  await screen.findAllByText(/Ada Lovelace/);
}

describe("UI-STYLE-01: Editable/read-only/invalid/disabled/busy field and button styles match Zen Green tokens", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    vi.mocked(api.getStoredRequesterId).mockReturnValue(null);
    vi.mocked(api.setStoredRequesterId).mockImplementation((id) =>
      sessionStorage.setItem("toktickit.requesterId", String(id)),
    );
    vi.mocked(api.clearStoredRequesterId).mockImplementation(() =>
      sessionStorage.removeItem("toktickit.requesterId"),
    );
    vi.mocked(api.createTicket).mockImplementation(async () => ({
      id: 1,
      ticketNumber: "TKT-2026-000001",
      requesterId: 1,
      categoryId: 1,
      relatedSystemId: 1,
      summary: "Test ticket",
      description: "This is a test description for the ticket.",
      requestedPriority: "MEDIUM",
      itPriority: null,
      ticketOwnerId: null,
      currentStatus: "NEW",
      createdAt: "2026-08-21T09:14:00.000Z",
      updatedAt: "2026-08-21T09:14:00.000Z",
    }));
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the Create Ticket form with editable input fields", async () => {
    await setupAuthenticatedApp();
    await userEvent.click(screen.getByRole("link", { name: "Create Ticket" }));
    await screen.findByLabelText(/Summary/);

    const summaryInput = screen.getByLabelText(/Summary/);
    // Editable fields exist and accept input
    expect(summaryInput.tagName).toBe("INPUT");
    expect((summaryInput as HTMLInputElement).readOnly).toBe(false);
  });

  it("renders read-only fields in a .read-only-row container with distinct CSS class", async () => {
    await setupAuthenticatedApp();
    await userEvent.click(screen.getByRole("link", { name: "Create Ticket" }));
    await screen.findByLabelText(/Summary/);

    // The read-only requester info should use .read-only-row class
    const readOnlyRow = document.querySelector(".read-only-row");
    expect(readOnlyRow).not.toBeNull();
  });

  it("renders invalid fields with .field-invalid CSS class and inline error message", async () => {
    await setupAuthenticatedApp();
    await userEvent.click(screen.getByRole("link", { name: "Create Ticket" }));
    await screen.findByLabelText(/Summary/);

    // Fill valid fields but leave summary empty
    await userEvent.selectOptions(screen.getByLabelText(/Category/), "1");
    await userEvent.selectOptions(screen.getByLabelText(/Related System/), "1");
    await userEvent.type(screen.getByLabelText(/Description/), "Valid description text for testing");

    // Submit with empty summary
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    // The summary input should have field-invalid class
    const summaryInput = screen.getByLabelText(/Summary/);
    expect(summaryInput.classList.contains("field-invalid")).toBe(true);

    // Error text should be present and inside the same form-field
    const errorText = screen.getByText("Summary is required.");
    expect(errorText).toBeTruthy();
    expect(errorText.classList.contains("field-error")).toBe(true);
  });

it("renders Submit button disabled only during submission (not pre-emptively)", async () => {
    await setupAuthenticatedApp();
    await userEvent.click(screen.getByRole("link", { name: "Create Ticket" }));
    await screen.findByLabelText(/Summary/);

    // The submit button is initially enabled because validation happens on submit
    const submitButton = screen.getByRole("button", { name: "Submit" });
    expect((submitButton as HTMLButtonElement).disabled).toBe(false);
    expect(submitButton.classList.contains("primary-button")).toBe(true);
  });

  it("renders busy Submit button with Submitting text during submission", async () => {
    vi.mocked(api.createTicket).mockReturnValue(new Promise(() => undefined));

    await setupAuthenticatedApp();
    await userEvent.click(screen.getByRole("link", { name: "Create Ticket" }));
    await screen.findByLabelText(/Summary/);

    await userEvent.selectOptions(screen.getByLabelText(/Category/), "1");
    await userEvent.selectOptions(screen.getByLabelText(/Related System/), "1");
    await userEvent.type(screen.getByLabelText(/Summary/), "Laptop battery drains quickly");
    await userEvent.type(screen.getByLabelText(/Description/), "Valid description text for testing that is long enough.");

    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    const submitButton = screen.getByRole("button", { name: /Submitting/i });
    expect((submitButton as HTMLButtonElement).disabled).toBe(true);
    expect(submitButton.textContent).toContain("Submitting");
  });

  it("uses primary-button class for primary actions", async () => {
    await setupAuthenticatedApp();
    await userEvent.click(screen.getByRole("link", { name: "Create Ticket" }));
    await screen.findByLabelText(/Summary/);

    const submitButton = screen.getByRole("button", { name: "Submit" });
    expect(submitButton.classList.contains("primary-button")).toBe(true);
  });

  it("renders the header with Change Requester secondary-style button", async () => {
    await setupAuthenticatedApp();

    const changeButton = screen.getByRole("button", { name: /change requester/i });
    expect(changeButton.classList.contains("header-button")).toBe(true);
  });

  it("renders navigation with nav-active class on active link", async () => {
    await setupAuthenticatedApp();

    // My Tickets should be active by default
    const myTicketsLink = screen.getByText("My Tickets");
    expect(myTicketsLink.classList.contains("nav-active")).toBe(true);
  });

  it("applies the authoritative Zen Green CSS custom properties in App.css", async () => {
    await setupAuthenticatedApp();
    // UI-STYLE-01: verify the actual required design-system tokens and their
    // authoritative values (ui-spec §1). jsdom does not load the external
    // stylesheet, so we import the real App.css source (the token source of
    // truth) via Vite's `?raw` and assert each required token is declared with
    // the exact value. This fails if a token is missing or its value is wrong.
    const expectedTokens: Record<string, string> = {
      "--color-primary": "#006B3C",
      "--color-secondary": "#0B7A46",
      "--color-pale-green": "#EAF6EF",
      "--color-bg": "#F5F7F6",
      "--color-surface": "#FFFFFF",
      "--color-text": "#1C2B24",
      "--color-field-editable-bg": "#FFFFFF",
      "--color-field-readonly-bg": "#F1F4F1",
      "--color-error": "#B3261E",
      "--color-warning": "#B7791F",
      "--color-success": "#0B7A46",
    };
    for (const [token, expected] of Object.entries(expectedTokens)) {
      const declaration = new RegExp(`${token}\\s*:\\s*${expected}\\s*;`);
      expect(appCss, `${token} is declared with value ${expected}`).toMatch(declaration);
    }
  });
});

describe("UI-STYLE-02: Required-field labels show red asterisk; validation messages render directly under fields", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    vi.mocked(api.getStoredRequesterId).mockReturnValue(null);
    vi.mocked(api.setStoredRequesterId).mockImplementation((id) =>
      sessionStorage.setItem("toktickit.requesterId", String(id)),
    );
    vi.mocked(api.clearStoredRequesterId).mockImplementation(() =>
      sessionStorage.removeItem("toktickit.requesterId"),
    );
  });

  afterEach(() => {
    cleanup();
  });

  it("shows red asterisk (.required-asterisk) next to required field labels", async () => {
    await setupAuthenticatedApp();
    await userEvent.click(screen.getByRole("link", { name: "Create Ticket" }));
    await screen.findByLabelText(/Summary/);

    // Check for the required-asterisk spans
    const asterisks = document.querySelectorAll(".required-asterisk");
    expect(asterisks.length).toBeGreaterThanOrEqual(4);

    // Each asterisk span should exist inside a label
    for (const asterisk of asterisks) {
      expect(asterisk.textContent).toBe("*");
      const label = asterisk.closest("label");
      expect(label).not.toBeNull();
    }
  });

  it("shows validation message directly under the field when empty summary is submitted", async () => {
    await setupAuthenticatedApp();
    await userEvent.click(screen.getByRole("link", { name: "Create Ticket" }));
    await screen.findByLabelText(/Summary/);

    await userEvent.selectOptions(screen.getByLabelText(/Category/), "1");
    await userEvent.selectOptions(screen.getByLabelText(/Related System/), "1");
    await userEvent.type(screen.getByLabelText(/Description/), "Valid description text for testing");

    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    // The validation message should be directly below the summary field
    const summaryField = screen.getByLabelText(/Summary/).closest(".form-field");
    expect(summaryField).not.toBeNull();
    const errorMessage = summaryField!.querySelector(".field-error");
    expect(errorMessage).not.toBeNull();
    expect(errorMessage!.textContent).toBe("Summary is required.");

    expect(api.createTicket).not.toHaveBeenCalled();
  });

  it("shows validation message directly under description field when too short", async () => {
    await setupAuthenticatedApp();
    await userEvent.click(screen.getByRole("link", { name: "Create Ticket" }));
    await screen.findByLabelText(/Summary/);

    await userEvent.selectOptions(screen.getByLabelText(/Category/), "1");
    await userEvent.selectOptions(screen.getByLabelText(/Related System/), "1");
    await userEvent.type(screen.getByLabelText(/Summary/), "Valid summary");
    await userEvent.type(screen.getByLabelText(/Description/), "Short");

    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    const descField = screen.getByLabelText(/Description/).closest(".form-field");
    expect(descField).not.toBeNull();
    const errorMessage = descField!.querySelector(".field-error");
    expect(errorMessage).not.toBeNull();
    expect(errorMessage!.textContent).toMatch(/at least 10 characters/);
  });
});

describe("UI-STYLE-03: Priority/Status/Removed badge styling and non-color-reliant labels", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    vi.mocked(api.getStoredRequesterId).mockReturnValue(null);
    vi.mocked(api.setStoredRequesterId).mockImplementation((id) =>
      sessionStorage.setItem("toktickit.requesterId", String(id)),
    );
    vi.mocked(api.clearStoredRequesterId).mockImplementation(() =>
      sessionStorage.removeItem("toktickit.requesterId"),
    );
    vi.mocked(api.fetchDevRequesters).mockImplementation(async () => requesters);
  });

  afterEach(() => {
    cleanup();
  });

  async function setupWithTicketData(data: ReturnType<typeof makeTicketData>[]) {
    vi.mocked(api.fetchRequesterContext).mockImplementation(async () => ({ requesterId: 1 }));
    vi.mocked(api.fetchCategories).mockImplementation(async () => categories);
    vi.mocked(api.fetchRelatedSystems).mockImplementation(async () => relatedSystems);
    vi.mocked(api.fetchMyTickets).mockImplementation(async () => ({
      data,
      pagination: { page: 1, pageSize: 10, totalItems: data.length, totalPages: 1, unfilteredTotalItems: data.length },
    }));

    render(<App />);

    await userEvent.selectOptions(await screen.findByRole("combobox", { name: /development requester/i }), "1");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findAllByText(/Ada Lovelace/);
  }

  function makeTicketData(id: number, overrides: Record<string, string> = {}) {
    return {
      id,
      ticketNumber: `TKT-2026-${String(id).padStart(6, "0")}`,
      categoryId: 1,
      categoryName: overrides.categoryName ?? "Hardware",
      summary: overrides.summary ?? `Ticket ${id}`,
      requestedPriority: overrides.requestedPriority ?? "MEDIUM",
      itPriority: null,
      currentStatus: overrides.currentStatus ?? "NEW",
      createdAt: "2026-08-21T09:14:00.000Z",
      updatedAt: "2026-08-21T09:14:00.000Z",
    };
  }

  it("renders priority badges with correct CSS classes and visible text labels", async () => {
    await setupWithTicketData([
      makeTicketData(1, { requestedPriority: "LOW", summary: "Low priority ticket" }),
      makeTicketData(2, { requestedPriority: "MEDIUM", summary: "Medium priority ticket" }),
      makeTicketData(3, { requestedPriority: "HIGH", summary: "High priority ticket" }),
    ]);

    // Use findAllByText because ticket summary renders in both desktop table and mobile cards
    const lowElements = await screen.findAllByText("Low priority ticket");
    expect(lowElements.length).toBeGreaterThanOrEqual(1);

    const badges = document.querySelectorAll(".priority-badge");
    expect(badges.length).toBeGreaterThanOrEqual(3);

    const badgeTexts = Array.from(badges).map((b) => b.textContent);
    expect(badgeTexts).toContain("LOW");
    expect(badgeTexts).toContain("MEDIUM");
    expect(badgeTexts).toContain("HIGH");
  });

  it("renders Status badge with status-new CSS class and visible NEW text", async () => {
    await setupWithTicketData([
      makeTicketData(1, { summary: "Test ticket" }),
    ]);

    const ticketElements = await screen.findAllByText("Test ticket");
    expect(ticketElements.length).toBeGreaterThanOrEqual(1);

    const statusBadge = document.querySelector(".status-badge");
    expect(statusBadge).not.toBeNull();
    expect(statusBadge!.textContent).toBe("NEW");
    expect(statusBadge!.classList.contains("status-new")).toBe(true);
  });

  it("applies distinct CSS classes for LOW, MEDIUM, and HIGH priority badges", async () => {
    await setupWithTicketData([
      makeTicketData(1, { requestedPriority: "LOW", summary: "Low priority ticket" }),
      makeTicketData(2, { requestedPriority: "MEDIUM", summary: "Medium priority ticket" }),
      makeTicketData(3, { requestedPriority: "HIGH", summary: "High priority ticket" }),
    ]);

    const lowElements = await screen.findAllByText("Low priority ticket");
    expect(lowElements.length).toBeGreaterThanOrEqual(1);

    const lowBadge = screen.getByText("LOW");
    const mediumBadge = screen.getByText("MEDIUM");
    const highBadge = screen.getByText("HIGH");

    expect(lowBadge.classList.contains("priority-low")).toBe(true);
    expect(mediumBadge.classList.contains("priority-medium")).toBe(true);
    expect(highBadge.classList.contains("priority-high")).toBe(true);
  });

  it("renders all badges with non-empty visible text (never color-only)", async () => {
    await setupWithTicketData([
      makeTicketData(1, { requestedPriority: "LOW", summary: "Test ticket" }),
    ]);

    // Use findAllByText because ticket summary appears in both table and mobile card
    const summaryElements = await screen.findAllByText("Test ticket");
    expect(summaryElements.length).toBeGreaterThanOrEqual(1);

    const allBadges = document.querySelectorAll(".priority-badge, .status-badge");
    expect(allBadges.length).toBeGreaterThanOrEqual(2);

    for (const badge of allBadges) {
      expect(badge.textContent).toBeTruthy();
      expect(badge.textContent!.trim().length).toBeGreaterThan(0);
    }
  });
});