import { mkdirSync } from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { USERS, createRequesterTicket, login, navigate, resetAccount } from "./helpers";

test.describe("E2E-04: authenticated Requester continuity", () => {
  test.beforeEach(async () => {
    await resetAccount("requester");
    await resetAccount("otherRequester");
  });

  test("creates, lists, opens, comments, and marks a ticket appears resolved", async ({ page, playwright }) => {
    const summary = `Issue 42 requester ${Date.now()}`;
    await login(page, USERS.requester.email);
    const ticketNumber = await createRequesterTicket(page, summary);
    await navigate(page, "My Tickets");
    await expect(page.locator(".tickets-table:visible, .tickets-cards:visible").getByText(summary, { exact: true })).toBeVisible();

    const directory = path.resolve("artifacts/lab-03/screenshots/authentication");
    mkdirSync(directory, { recursive: true });
    await page.screenshot({ path: path.join(directory, `${test.info().project.name}-requester-my-tickets.png`) });
    await page.getByRole("link", { name: ticketNumber }).click();
    await expect(page.locator(".ticket-detail")).toBeVisible();
    await page.screenshot({ path: path.join(directory, `${test.info().project.name}-requester-ticket-detail.png`) });
    await page.getByLabel("Add a comment").fill("Requester continuity public comment.");
    await page.getByRole("button", { name: "Post Comment" }).click();
    await expect(page.getByText("Requester continuity public comment.")).toBeVisible();

    await page.getByRole("button", { name: "Indicate problem appears resolved" }).click();
    await expect(page.getByText("You have indicated the problem appears resolved.")).toBeVisible();
    await expect(page.locator(".status-badge")).toHaveText("NEW");

    const other = await playwright.request.newContext();
    try {
      const loginResponse = await other.post("http://127.0.0.1:3000/api/auth/login", {
        data: { email: USERS.otherRequester.email, password: "E2eTestPass123!xyz" },
      });
      expect(loginResponse.status()).toBe(200);
      const forbiddenDetail = await other.get(`http://127.0.0.1:3000/api/tickets/${ticketNumber}`);
      expect(forbiddenDetail.status()).toBe(404);
    } finally {
      await other.dispose();
    }
  });
});
