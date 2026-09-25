import { mkdirSync } from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { USERS, createRequesterTicket, login, navigate, resetAccount } from "./helpers";

function screenshot(folder: string, file: string): string {
  const directory = path.resolve(`artifacts/lab-03/screenshots/${folder}`);
  mkdirSync(directory, { recursive: true });
  return path.join(directory, `${test.info().project.name}-${file}.png`);
}

async function confirmStatusWithKeyboard(page: import("@playwright/test").Page): Promise<void> {
  const dialog = page.getByRole("dialog", { name: "Confirm status change" });
  const confirm = dialog.getByRole("button", { name: "Confirm", exact: true });
  await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(confirm).toBeFocused();
  await page.keyboard.press("Enter");
}

test.describe("E2E-02: Staff ticket queue and detail operations", () => {
  test.beforeEach(async () => {
    await resetAccount("requester");
    await resetAccount("staff");
    await resetAccount("adminPeer");
  });

  test("searches, assigns, prioritizes, transitions, comments, and records a private note", async ({ page }) => {
    const summary = `Issue 42 staff ${Date.now()}`;
    await login(page, USERS.requester.email);
    const ticketNumber = await createRequesterTicket(page, summary);
    await page.getByRole("button", { name: "Logout" }).click();
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

    await login(page, USERS.staff.email);
    await navigate(page, "Ticket Queue");
    await expect(page.getByRole("heading", { name: "Ticket Queue" })).toBeVisible();
    await page.getByLabel("Search tickets").fill(summary);
    await expect(page.locator(".tickets-table-wrapper:visible, .tickets-cards:visible").getByText(summary, { exact: true })).toBeVisible();
    await page.screenshot({ path: screenshot("staff-queue", "queue-filtered") });
    await page.getByRole("button", { name: "Open Detail" }).click();
    await expect(page.getByRole("heading", { name: ticketNumber })).toBeVisible();
    await page.screenshot({ path: screenshot("staff-ticket-detail", "detail-unassigned") });

    await page.getByLabel("Ticket Owner").selectOption({ label: `${USERS.adminPeer.name} — Administrator` });
    await page.getByRole("button", { name: "Assign", exact: true }).click();
    await expect(page.getByText(`User #`, { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "Claim / Reassign to me" }).click();
    await expect(page.getByRole("button", { name: "Claimed by you" })).toBeVisible();

    await page.getByLabel("IT Priority").selectOption("HIGH");
    await expect(page.locator(".ticket-info-row").filter({ hasText: "IT Priority" })).toContainText("HIGH");
    await page.locator(".transition-buttons").getByRole("button", { name: "Open" }).click();
    await expect(page.locator(".status-badge")).toHaveText("OPEN");
    await page.locator(".transition-buttons").getByRole("button", { name: "In Progress" }).click();
    await expect(page.locator(".status-badge")).toHaveText("IN_PROGRESS");

    await page.getByLabel("Add a comment").fill("Public update from the integrated E2E flow.");
    await page.getByRole("button", { name: "Post Comment" }).click();
    await expect(page.getByText("Public update from the integrated E2E flow.")).toBeVisible();
    await page.getByLabel("Add an internal note").fill("Private diagnostic note for staff.");
    await page.getByRole("button", { name: "Post Note" }).click();
    await expect(page.getByText("Private diagnostic note for staff.")).toBeVisible();

    await page.locator(".transition-buttons").getByRole("button", { name: "Resolved" }).click();
    await expect(page.getByRole("heading", { name: "Confirm status change" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(".status-badge")).toHaveText("IN_PROGRESS");
    await page.locator(".transition-buttons").getByRole("button", { name: "Resolved" }).click();
    await confirmStatusWithKeyboard(page);
    await expect(page.locator(".status-badge")).toHaveText("RESOLVED");
    await page.locator(".transition-buttons").getByRole("button", { name: "Closed" }).click();
    await confirmStatusWithKeyboard(page);
    await expect(page.locator(".status-badge")).toHaveText("CLOSED");
  });
});
