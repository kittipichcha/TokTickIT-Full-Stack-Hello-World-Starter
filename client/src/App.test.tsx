import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import App from "./App";
import * as api from "./api";

vi.mock("./api");

describe("Application Shell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.setItem("toktickit.requesterId", "1");
    vi.mocked(api.fetchDevRequesters).mockResolvedValue([
      { id: 1, name: "Ada Lovelace", email: "ada@example.com" },
    ]);
    vi.mocked(api.getStoredRequesterId).mockImplementation(() => {
      const stored = sessionStorage.getItem("toktickit.requesterId");
      return stored ? Number(stored) : null;
    });
    vi.mocked(api.setStoredRequesterId).mockImplementation((id) => sessionStorage.setItem("toktickit.requesterId", String(id)));
    vi.mocked(api.clearStoredRequesterId).mockImplementation(() => sessionStorage.removeItem("toktickit.requesterId"));
  });

  afterEach(() => {
    cleanup();
    sessionStorage.clear();
  });

  it("should render header with wordmark, navigation, and selected requester", async () => {
    render(<App />);

    expect(await screen.findByText("TokTickIT")).toBeDefined();
    expect(screen.getByRole("navigation", { name: /primary/i })).toBeDefined();
    expect(screen.getByText("My Tickets")).toBeDefined();
    expect(screen.getByText("Create Ticket")).toBeDefined();
    expect(screen.getByText("Ada Lovelace")).toBeDefined();
    expect(screen.getByRole("button", { name: /change requester/i })).toBeDefined();
  });

  it("should render the System Overview shell content", async () => {
    render(<App />);

    expect(await screen.findByRole("heading", { name: /system overview/i })).toBeDefined();
  });

  describe("Check System Button", () => {
    it("should render the Check System button", async () => {
      render(<App />);
      const button = await screen.findByRole("button", { name: /check system/i });
      expect(button).toBeDefined();
    });

    it("should show loading state when checking system", async () => {
      vi.mocked(api.checkHealth).mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve({ status: "ok", service: "TokTickIT API" }), 100);
          })
      );
      vi.mocked(api.fetchCategories).mockResolvedValue([]);

      render(<App />);
      const button = await screen.findByRole("button", { name: /check system/i });
      fireEvent.click(button);

      expect(screen.getByRole("button", { name: /checking/i })).toBeDefined();
    });

    it("should display health status on successful health check and load categories", async () => {
      const mockCategories = [
        { id: 1, name: "Account and Access" },
        { id: 2, name: "Hardware" },
      ];

      vi.mocked(api.checkHealth).mockResolvedValue({ status: "ok", service: "TokTickIT API" });
      vi.mocked(api.fetchCategories).mockResolvedValue(mockCategories);

      render(<App />);
      const button = await screen.findByRole("button", { name: /check system/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText(/connection successful/i)).toBeDefined();
      });

      await waitFor(() => {
        expect(screen.getByText(/available categories/i)).toBeDefined();
      });

      mockCategories.forEach((category) => {
        expect(screen.getByText(new RegExp(category.name))).toBeDefined();
      });
    });

    it("should show error when health check fails", async () => {
      const errorMessage = "Health check failed: 503 Service Unavailable";
      vi.mocked(api.checkHealth).mockRejectedValue(new Error(errorMessage));

      render(<App />);
      const button = await screen.findByRole("button", { name: /check system/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText(new RegExp(errorMessage))).toBeDefined();
      });
    });

    it("should show error when categories fail to load after health check", async () => {
      const errorMessage = "Failed to fetch categories: 500 Internal Server Error";
      vi.mocked(api.checkHealth).mockResolvedValue({ status: "ok", service: "TokTickIT API" });
      vi.mocked(api.fetchCategories).mockRejectedValue(new Error(errorMessage));

      render(<App />);
      const button = await screen.findByRole("button", { name: /check system/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText(new RegExp(errorMessage))).toBeDefined();
      });
    });

    it("should not load categories if health check returns error status", async () => {
      vi.mocked(api.checkHealth).mockResolvedValue({
        status: "fail",
        service: "TokTickIT API",
      });

      render(<App />);
      const button = await screen.findByRole("button", { name: /check system/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText(/system health check failed/i)).toBeDefined();
      });

      expect(vi.mocked(api.fetchCategories)).not.toHaveBeenCalled();
    });
  });
});
