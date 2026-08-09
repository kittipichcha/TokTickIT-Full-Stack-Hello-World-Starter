import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import App from "./App";
import * as api from "./api";

vi.mock("./api");

describe("Categories UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("should render the Load Categories button", () => {
    render(<App />);
    const button = screen.getByRole("button", { name: /load categories/i });
    expect(button).toBeDefined();
  });

  it("should show loading state when fetching categories", async () => {
    vi.mocked(api.fetchCategories).mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve([
                { id: 1, name: "Account and Access" },
                { id: 2, name: "Hardware" },
              ]),
            100
          );
        })
    );

    render(<App />);
    const button = screen.getByRole("button", { name: /load categories/i });
    fireEvent.click(button);

    expect(screen.getByRole("button", { name: /loading/i })).toBeDefined();
  });

  it("should display categories after successful fetch", async () => {
    const mockCategories = [
      { id: 1, name: "Account and Access" },
      { id: 2, name: "Hardware" },
      { id: 3, name: "Software" },
    ];

    vi.mocked(api.fetchCategories).mockResolvedValue(mockCategories);

    render(<App />);
    const button = screen.getByRole("button", { name: /load categories/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(/available categories/i)).toBeDefined();
    });

    mockCategories.forEach((category) => {
      expect(screen.getByText(new RegExp(category.name))).toBeDefined();
    });
  });

  it("should display categories in the expected order", async () => {
    const mockCategories = [
      { id: 1, name: "Account and Access" },
      { id: 2, name: "Hardware" },
    ];

    vi.mocked(api.fetchCategories).mockResolvedValue(mockCategories);

    render(<App />);
    const button = screen.getByRole("button", { name: /load categories/i });
    fireEvent.click(button);

    await waitFor(() => {
      const listItems = screen.getAllByRole("listitem");
      expect(listItems.length).toBe(2);
      expect(listItems[0].textContent).toContain("Account and Access");
      expect(listItems[1].textContent).toContain("Hardware");
    });
  });

  it("should show error state when fetch fails", async () => {
    const errorMessage = "Failed to load categories";
    vi.mocked(api.fetchCategories).mockRejectedValue(new Error(errorMessage));

    render(<App />);
    const button = screen.getByRole("button", { name: /load categories/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(new RegExp(errorMessage))).toBeDefined();
    });
  });

  it("should show message when no categories exist", async () => {
    vi.mocked(api.fetchCategories).mockResolvedValue([]);

    render(<App />);
    const button = screen.getByRole("button", { name: /load categories/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(/no categories found/i)).toBeDefined();
    });
  });

  it("should display category IDs and names together", async () => {
    const mockCategories = [{ id: 42, name: "Test Category" }];
    vi.mocked(api.fetchCategories).mockResolvedValue(mockCategories);

    render(<App />);
    const button = screen.getByRole("button", { name: /load categories/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(/id 42:/i)).toBeDefined();
      expect(screen.getByText(/test category/i)).toBeDefined();
    });
  });
});
