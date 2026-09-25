import { mkdirSync } from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { CHANGED_PASSWORD, FORCED_PASSWORD, USERS, login, navigate, resetAccount } from "./helpers";

function savePath(file: string): string {
  const directory = path.resolve("artifacts/lab-03/screenshots/authentication");
  mkdirSync(directory, { recursive: true });
  return path.join(directory, `${test.info().project.name}-${file}.png`);
}

test.describe("E2E-01: authentication and mandatory password change", () => {
  test.beforeEach(async () => resetAccount("forced", true, FORCED_PASSWORD));

  test("forced-change user completes the same-session flow and can log out", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await page.screenshot({ path: savePath("login-default") });
    await page.getByLabel("Email").fill(USERS.forced.email);
    await page.getByLabel("Password").fill(FORCED_PASSWORD);
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page.getByRole("heading", { name: "Change your password" })).toBeVisible();
    await expect(page.locator(".app-shell")).toHaveCount(0);
    await page.screenshot({ path: savePath("change-password-default") });
    await page.getByLabel("Current password").fill(FORCED_PASSWORD);
    await page.getByLabel(/^new password/i).fill(CHANGED_PASSWORD);
    await page.getByLabel(/^confirm new password/i).fill(CHANGED_PASSWORD);
    await page.getByRole("button", { name: "Change password" }).click();

    await expect(page.locator(".app-header").first()).toBeVisible();
    await navigate(page, "Create Ticket");
    await expect(page.getByRole("heading", { name: "Create Ticket" }).last()).toBeVisible();
    await page.reload();
    await expect(page.locator(".app-header").first()).toBeVisible();
    await navigate(page, "Create Ticket");
    await page.getByRole("button", { name: "Logout" }).click();
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });

  test("invalid credentials show a safe message", async ({ page }) => {
    await login(page, "unknown-issue-42@example.com", "WrongPass123!xyz", "none");
    await expect(page.getByRole("alert")).toHaveText("Login failed. Please check your credentials and try again.");
    await expect(page.locator(".app-shell")).toHaveCount(0);
  });
});
