import { jsx as _jsx } from "react/jsx-runtime";
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
    describe("Check System Button", () => {
        it("should render the Check System button", () => {
            render(_jsx(App, {}));
            const button = screen.getByRole("button", { name: /check system/i });
            expect(button).toBeDefined();
        });
        it("should show loading state when checking system", async () => {
            vi.mocked(api.checkHealth).mockImplementation(() => new Promise((resolve) => {
                setTimeout(() => resolve({ status: "ok", service: "TokTickIT API" }), 100);
            }));
            vi.mocked(api.fetchCategories).mockResolvedValue([]);
            render(_jsx(App, {}));
            const button = screen.getByRole("button", { name: /check system/i });
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
            render(_jsx(App, {}));
            const button = screen.getByRole("button", { name: /check system/i });
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
            render(_jsx(App, {}));
            const button = screen.getByRole("button", { name: /check system/i });
            fireEvent.click(button);
            await waitFor(() => {
                expect(screen.getByText(new RegExp(errorMessage))).toBeDefined();
            });
        });
        it("should show error when categories fail to load after health check", async () => {
            const errorMessage = "Failed to fetch categories: 500 Internal Server Error";
            vi.mocked(api.checkHealth).mockResolvedValue({ status: "ok", service: "TokTickIT API" });
            vi.mocked(api.fetchCategories).mockRejectedValue(new Error(errorMessage));
            render(_jsx(App, {}));
            const button = screen.getByRole("button", { name: /check system/i });
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
            render(_jsx(App, {}));
            const button = screen.getByRole("button", { name: /check system/i });
            fireEvent.click(button);
            await waitFor(() => {
                expect(screen.getByText(/system health check failed/i)).toBeDefined();
                expect(screen.queryByText(/toktickit api/i)).toBeNull();
            });
            expect(vi.mocked(api.fetchCategories)).not.toHaveBeenCalled();
        });
    });
});
