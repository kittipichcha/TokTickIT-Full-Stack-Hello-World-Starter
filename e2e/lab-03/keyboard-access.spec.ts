import { test, expect } from "@playwright/test";
import { USERS, createRequesterTicket, login, navigate, resetAccount } from "./helpers";

test.describe("A11Y-01: keyboard and focus behavior", () => {
  test.beforeEach(async () => {
    await resetAccount("requester");
    await resetAccount("staff");
  });

  test("login controls expose labels and visible keyboard focus", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    const email = page.getByLabel("Email");
    for (let index = 0; index < 20 && !(await email.evaluate((element) => element === document.activeElement)); index += 1) {
      await page.keyboard.press("Tab");
    }
    await expect(email).toBeFocused();
    const outlineStyle = await page.getByLabel("Email").evaluate((element) => getComputedStyle(element).outlineStyle);
    expect(outlineStyle).not.toBe("none");
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Password")).toBeFocused();
  });

  test("status confirmation traps keyboard focus, Escape cancels, and focus returns", async ({ page }) => {
    const summary = `Issue 42 keyboard ${Date.now()}`;
    await login(page, USERS.requester.email);
    await createRequesterTicket(page, summary);
    await page.getByRole("button", { name: "Logout" }).click();
    await login(page, USERS.staff.email);
    await navigate(page, "Ticket Queue");
    await page.getByLabel("Search tickets").fill(summary);
    await page.getByRole("button", { name: "Open Detail" }).click();
    await page.getByRole("button", { name: "Claim / Reassign to me" }).click();
    await expect(page.getByRole("button", { name: "Claimed by you" })).toBeVisible();
    await page.locator(".transition-buttons").getByRole("button", { name: "Open" }).click();
    await expect(page.locator(".status-badge")).toHaveText("OPEN");
    await page.locator(".transition-buttons").getByRole("button", { name: "In Progress" }).click();
    await expect(page.locator(".status-badge")).toHaveText("IN_PROGRESS");

    const resolvedButton = page.locator(".transition-buttons").getByRole("button", { name: "Resolved" });
    await expect(resolvedButton).toBeVisible();
    await expect(resolvedButton).toBeEnabled();
    await resolvedButton.focus();
    await expect(resolvedButton).toBeFocused();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Confirm status change" });
    await expect(dialog).toBeVisible();
    const cancel = dialog.getByRole("button", { name: "Cancel" });
    await expect(cancel).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(dialog.getByRole("button", { name: "Confirm" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(cancel).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(resolvedButton).toBeFocused();
    await expect(page.locator(".status-badge")).toHaveText("IN_PROGRESS");
  });
});
