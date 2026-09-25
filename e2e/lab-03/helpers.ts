import { expect, type Page } from "@playwright/test";
import { createRequire } from "node:module";
import path from "node:path";

export const PASSWORD = "E2eTestPass123!xyz";
export const CHANGED_PASSWORD = "E2eChangedPass456!abc";
export const FORCED_PASSWORD = "ForcedStart123!abc";

export const USERS = {
  requester: { email: "e2e-42-requester@example.com", name: "Issue 42 Requester", role: "REQUESTER" },
  otherRequester: { email: "e2e-42-other@example.com", name: "Issue 42 Other Requester", role: "REQUESTER" },
  staff: { email: "e2e-42-staff@example.com", name: "Issue 42 Staff", role: "IT_STAFF" },
  admin: { email: "e2e-42-admin@example.com", name: "Issue 42 Admin", role: "ADMINISTRATOR" },
  adminPeer: { email: "e2e-42-admin-peer@example.com", name: "Issue 42 Admin Peer", role: "ADMINISTRATOR" },
  forced: { email: "e2e-42-forced@example.com", name: "Issue 42 Forced Change", role: "REQUESTER" },
} as const;

export async function resetAccount(key: keyof typeof USERS, mustChangePassword = false, password = PASSWORD): Promise<void> {
  const databaseUrl = process.env.E2E_DATABASE_URL;
  if (!databaseUrl) throw new Error("E2E_DATABASE_URL is required for the Lab 3 fixture reset.");
  process.env.DATABASE_URL = databaseUrl;
  const serverRequire = createRequire(path.resolve(__dirname, "../../server/package.json"));
  const { PrismaClient } = serverRequire("@prisma/client") as { PrismaClient: new () => {
    user: {
      findUnique: (args: unknown) => Promise<{ id: number } | null>;
      update: (args: unknown) => Promise<unknown>;
      deleteMany: (args: unknown) => Promise<unknown>;
    };
    ticket: {
      findMany: (args: unknown) => Promise<Array<{ id: number }>>;
      delete: (args: unknown) => Promise<unknown>;
    };
    attachment: { deleteMany: (args: unknown) => Promise<unknown> };
    comment: { deleteMany: (args: unknown) => Promise<unknown> };
    internalNote: { deleteMany: (args: unknown) => Promise<unknown> };
    $disconnect: () => Promise<void>;
  } };
  const bcrypt = serverRequire("bcrypt") as { hash: (password: string, rounds: number) => Promise<string> };
  const account = USERS[key];
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { email: account.email }, select: { id: true } });
    if (!user) throw new Error(`Fixture account is missing: ${account.email}`);
    const tickets = await prisma.ticket.findMany({ where: { requesterId: user.id }, select: { id: true } });
    for (const ticket of tickets) {
      await prisma.comment.deleteMany({ where: { ticketId: ticket.id } });
      await prisma.internalNote.deleteMany({ where: { ticketId: ticket.id } });
      await prisma.attachment.deleteMany({ where: { ticketId: ticket.id } });
      await prisma.ticket.delete({ where: { id: ticket.id } });
    }
    await prisma.user.update({
      where: { email: account.email },
      data: { name: account.name, role: account.role, isActive: true, mustChangePassword, passwordHash: await bcrypt.hash(password, 10) },
    });
    if (key === "admin") {
      await prisma.user.deleteMany({ where: { email: { startsWith: "issue42-created-" } } });
    }
  } finally {
    await prisma.$disconnect();
  }
}

export async function login(
  page: Page,
  email: string,
  password = PASSWORD,
  waitFor: "shell" | "change-password" | "none" = "shell",
): Promise<void> {
  await page.goto("/");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Login" }).click();
  if (waitFor === "shell") await expect(page.locator(".app-header").first()).toBeVisible();
  if (waitFor === "change-password") {
    await expect(page.getByRole("heading", { name: "Change your password" })).toBeVisible();
  }
}

export async function expectAppShell(page: Page): Promise<void> {
  await expect(page.locator(".app-shell")).toBeVisible();
}

export async function navigate(page: Page, label: string): Promise<void> {
  const nav = page.locator("#primary-navigation");
  if (!(await nav.isVisible())) await page.locator(".hamburger").click();
  await page.getByRole("link", { name: label, exact: true }).click();
}

export async function createRequesterTicket(page: Page, summary: string): Promise<string> {
  await navigate(page, "Create Ticket");
  await page.locator("#categoryId").selectOption({ index: 1 });
  await page.locator("#relatedSystemId").selectOption({ index: 1 });
  await page.locator("#summary").fill(summary);
  await page.locator("#description").fill("Issue 42 integrated verification ticket description.");
  await page.getByRole("button", { name: "Submit" }).click();
  const ticketNumber = (await page.locator(".ticket-info-value").first().innerText()).trim();
  expect(ticketNumber).toMatch(/^TKT-\d{4}-\d{6}$/);
  return ticketNumber;
}
