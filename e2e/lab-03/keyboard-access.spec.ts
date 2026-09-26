import { test, expect, type Locator, type Page } from "@playwright/test";
import { CHANGED_PASSWORD, FORCED_PASSWORD, USERS, createRequesterTicket, login, navigate, resetAccount } from "./helpers";

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
    await expectKeyboardFocus(email);
    await page.keyboard.press("Tab");
    await expectKeyboardFocus(page.getByLabel("Password"));
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

  test("forced password change is reachable and submittable by keyboard", async ({ page }) => {
    await resetAccount("forced", true, FORCED_PASSWORD);
    try {
      await login(page, USERS.forced.email, FORCED_PASSWORD, "change-password");
      await tabTo(page, page.locator("#chpwd-current"));
      await page.locator("#chpwd-current").fill(FORCED_PASSWORD);
      await tabTo(page, page.locator("#chpwd-new"));
      await page.locator("#chpwd-new").fill(CHANGED_PASSWORD);
      await tabTo(page, page.locator("#chpwd-confirm"));
      await page.locator("#chpwd-confirm").fill(CHANGED_PASSWORD);
      const submit = page.getByRole("button", { name: "Change password" });
      await tabTo(page, submit);
      await page.keyboard.press("Enter");
      await expect(page.locator(".app-header").first()).toBeVisible();
    } finally {
      await resetAccount("forced", true, FORCED_PASSWORD);
    }
  });

  test("primary controls are reachable by Tab across Requester, Staff, and Admin screens", async ({ page }) => {
    await resetAccount("admin");
    const summary = `Issue 42 keyboard traversal ${Date.now()}`;
    await login(page, USERS.requester.email);
    await navigateByKeyboard(page, "Create Ticket", page.locator("#summary"));
    await tabTo(page, page.locator("#summary"));
    const ticketNumber = await createRequesterTicket(page, summary);

    await navigateByKeyboard(page, "My Tickets", page.getByRole("searchbox", { name: "Search tickets" }));
    await tabTo(page, page.getByRole("link", { name: ticketNumber }));
    await page.keyboard.press("Enter");
    await tabTo(page, page.locator("#comment-input"));

    await page.getByRole("button", { name: "Logout" }).click();
    await login(page, USERS.staff.email);
    await navigateByKeyboard(page, "Ticket Queue", page.getByRole("searchbox", { name: "Search tickets" }));
    await tabTo(page, page.getByLabel("Search tickets"));
    await page.getByLabel("Search tickets").fill(summary);
    const openDetail = page.getByRole("button", { name: "Open Detail" });
    await tabTo(page, openDetail);
    await page.keyboard.press("Enter");
    const owner = page.locator("#owner-select");
    await expect(owner).toBeEnabled();
    await tabTo(page, owner);

    await page.getByRole("button", { name: "Logout" }).click();
    await login(page, USERS.admin.email);
    await navigateByKeyboard(page, "User Management", page.getByRole("heading", { name: "User Management", exact: true }));
    await tabTo(page, page.getByRole("button", { name: "Create User" }));
  });
});

async function tabTo(page: Page, target: Locator): Promise<void> {
  for (let index = 0; index < 60; index += 1) {
    if (await target.evaluate((element) => element === document.activeElement)) {
      await expectKeyboardFocus(target);
      return;
    }
    await page.keyboard.press("Tab");
  }
  throw new Error("Target control was not reachable within 60 Tab presses.");
}

async function navigateByKeyboard(page: Page, label: string, destination: Locator): Promise<void> {
  const hamburger = page.locator(".hamburger");
  if (await hamburger.isVisible()) {
    await tabTo(page, hamburger);
    await page.keyboard.press("Enter");
  }
  const link = page.locator("#primary-navigation").getByRole("link", { name: label, exact: true });
  await tabTo(page, link);
  await page.keyboard.press("Enter");
  await expect(destination).toBeVisible();
}

async function expectKeyboardFocus(target: Locator): Promise<void> {
  await expect(target).toBeFocused();
  await expect(target).toHaveCSS("outline-style", "solid");
  await expect(target).toHaveCSS("outline-width", "2px");
}
