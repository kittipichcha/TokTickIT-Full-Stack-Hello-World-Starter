import { test, expect, type Page } from "@playwright/test";
import { createRequire } from "node:module";
import path from "node:path";
import { mkdirSync } from "node:fs";
import { USERS, login, navigate, resetAccount } from "../lab-03/helpers";

const serverRequire = createRequire(path.resolve("server/package.json"));
const { PrismaClient } = serverRequire("@prisma/client");
const marker = "[e2e-54-dashboard]";
type ReadAudit = { method: string; bodyless: boolean; sessionCookieMatches: boolean; identityInQuery: boolean; intentionalRequesterOverride: boolean; identityInHeaders: boolean };
const readAudits = new WeakMap<Page, Promise<ReadAudit>[]>();

function trackAuthenticatedReads(page: Page) {
  if (readAudits.has(page)) return;
  const audits: Promise<ReadAudit>[] = [];
  readAudits.set(page, audits);
  page.on("request", request => {
    const url = new URL(request.url());
    const isDashboard = /^\/api\/(requester|staff)\/dashboard$/.test(url.pathname);
    const isList = url.pathname === "/api/tickets" || url.pathname === "/api/staff/queue";
    const isSelectedAction = /^\/api\/tickets\/[^/]+\/actions\/[^/]+$/.test(url.pathname);
    if (!isDashboard && !isList && !isSelectedAction) return;
    audits.push((async () => {
      const headers = await request.allHeaders();
      const cookieHeader = headers.cookie ?? "";
      const sessionCookie = (await page.context().cookies(request.url())).find(cookie => cookie.name === "connect.sid");
      const cookiePair = cookieHeader.split(";").map(part => part.trim()).find(part => part.startsWith("connect.sid="));
      let cookieMatches = false;
      if (sessionCookie && cookiePair) {
        try {
          cookieMatches = decodeURIComponent(cookiePair.slice("connect.sid=".length)) === decodeURIComponent(sessionCookie.value);
        } catch { cookieMatches = cookiePair.slice("connect.sid=".length) === sessionCookie.value; }
      }
      const identityNames = new Set(["userid", "requesterid", "staffid", "actorid"]);
      return {
        method: request.method(),
        bodyless: request.postDataBuffer() === null,
        sessionCookieMatches: cookieMatches,
        identityInQuery: [...url.searchParams.keys()].some(key => identityNames.has(key.toLowerCase().replace(/[-_]/g, ""))),
        intentionalRequesterOverride: url.pathname === "/api/requester/dashboard" && url.searchParams.has("requesterId"),
        identityInHeaders: Object.keys(headers).some(name => /^(?:x-(?:auth-|acting-|identity-))?(?:user|requester|staff|actor)-?id$/i.test(name)),
      };
    })());
  });
}

async function expectAuthenticatedReads(page: Page) {
  const audits = await Promise.all(readAudits.get(page) ?? []);
  expect(audits.length).toBeGreaterThan(0);
  for (const audit of audits) {
    expect(audit.method).toBe("GET");
    expect(audit.bodyless).toBe(true);
    expect(audit.sessionCookieMatches).toBe(true);
    expect(audit.identityInQuery).toBe(audit.intentionalRequesterOverride);
    expect(audit.identityInHeaders).toBe(false);
  }
}

async function fixture(manyTickets = false) {
  if (!process.env.E2E_DATABASE_URL) throw new Error("Disposable E2E_DATABASE_URL required.");
  const prisma = new PrismaClient({ datasources: { db: { url: process.env.E2E_DATABASE_URL } } });
  try {
    const requester = await prisma.user.findUniqueOrThrow({ where: { email: USERS.requester.email } });
    const staff = await prisma.user.findUniqueOrThrow({ where: { email: USERS.staff.email } });
    const category = await prisma.category.findFirstOrThrow({ where: { isActive: true } });
    const system = await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } });
    const ticketNumber = `TKT-2054-${String(Date.now() % 1_000_000).padStart(6, "0")}`;
    const ticket = await prisma.ticket.create({ data: {
      ticketNumber, requesterId: requester.id, categoryId: category.id, relatedSystemId: system.id,
      summary: `${marker} ${ticketNumber}`, description: marker,
      requestedPriority: "HIGH", itPriority: "HIGH", ticketOwnerId: staff.id,
      currentStatus: "WAITING_FOR_REQUESTER",
    } });
    const actions = [];
    if (manyTickets) for (let index = 1; index <= 20; index++) await prisma.ticket.create({ data: {
      ticketNumber: `TKT-2054-${String((Number(ticketNumber.slice(-6)) + index) % 1_000_000).padStart(6, "0")}`,
      requesterId: requester.id, categoryId: category.id, relatedSystemId: system.id,
      summary: `${marker} extra ${index}`, description: marker, requestedPriority: "HIGH", itPriority: "HIGH",
      ticketOwnerId: staff.id, currentStatus: "WAITING_FOR_REQUESTER",
    } });
    for (let index = 1; index <= 21; index++) actions.push(await prisma.actionTaken.create({ data: {
      ticketId: ticket.id, description: `${marker} Action ${index}`, performedByUserId: staff.id,
      assigneeUserId: staff.id, status: "PENDING", createdAt: new Date(Date.now() - (21 - index) * 1000),
    } }));
    return { ticketNumber, selectedActionId: actions[20].id, staffId: staff.id };
  } finally { await prisma.$disconnect(); }
}

async function dashboard(page: Page, role: "requester" | "staff", email: string) {
  trackAuthenticatedReads(page);
  const response = page.waitForResponse(response => response.url().endsWith(`/api/${role}/dashboard`) && response.request().method() === "GET");
  await login(page, email);
  const result = await response;
  expect(result.status()).toBe(200);
  await expect(page.getByRole("heading", { name: role === "requester" ? "Requester Dashboard" : "Staff Dashboard", exact: true })).toBeVisible();
  return (await result.json()).data;
}

test.describe("E2E-02: role dashboards and exact destinations", () => {
  test.setTimeout(90_000);
  test.beforeEach(async () => {
    await resetAccount("requester");
    await resetAccount("staff");
    await resetAccount("admin");
  });
  test.afterEach(async () => { await resetAccount("requester"); });

  test("Requester server count opens the same complete filtered My Tickets destination", async ({ page }) => {
    const { ticketNumber, staffId } = await fixture(true);
    const data = await dashboard(page, "requester", USERS.requester.email);
    expect(data.counts.openTickets).toBe(21);
    expect(data.counts.waitingForRequester).toBe(21);
    const overrideResponse = await page.evaluate(async staffId => {
      const response = await fetch(`http://localhost:3000/api/requester/dashboard?requesterId=${staffId}`, { credentials: "include" });
      return { status: response.status, data: (await response.json()).data };
    }, staffId);
    expect(overrideResponse.status).toBe(200);
    expect(overrideResponse.data.counts).toEqual(data.counts);
    for (const key of ["attentionTickets", "recentTickets"] as const) {
      expect(overrideResponse.data.lists[key].map((ticket: { ticketNumber: string }) => ticket.ticketNumber)).toEqual(
        data.lists[key].map((ticket: { ticketNumber: string }) => ticket.ticketNumber),
      );
    }
    await expect(page.locator("#primary-navigation").getByRole("link", { includeHidden: true })).toHaveText(["Dashboard", "My Tickets", "Create Ticket"]);
    const listResponse = page.waitForResponse(response => {
      const url = new URL(response.url());
      return url.pathname === "/api/tickets" && url.searchParams.get("scope") === "open";
    });
    await page.getByRole("button", { name: /Open Tickets/ }).click();
    const list = await listResponse;
    expect(list.status()).toBe(200);
    expect((await list.json()).pagination.totalItems).toBe(data.counts.openTickets);
    const page2 = page.waitForResponse(response => {
      const url = new URL(response.url()); return url.pathname === "/api/tickets" && url.searchParams.get("page") === "2" && url.searchParams.get("scope") === "open";
    });
    await page.getByRole("button", { name: /Next/ }).click();
    expect((await (await page2).json()).data).toHaveLength(10);
    const page3 = page.waitForResponse(response => {
      const url = new URL(response.url()); return url.pathname === "/api/tickets" && url.searchParams.get("page") === "3" && url.searchParams.get("scope") === "open";
    });
    await page.getByRole("button", { name: /Next/ }).click();
    expect((await (await page3).json()).data).toHaveLength(1);
    await page.getByRole("link", { name: ticketNumber, exact: true }).first().click();
    await expect(page.getByRole("heading", { name: new RegExp(`^${ticketNumber}`) })).toBeVisible();
    await expect(page.locator("#primary-navigation").getByRole("link", { name: "My Tickets", exact: true, includeHidden: true })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("button", { name: "Add Action" })).toHaveCount(0);
    await navigate(page, "Dashboard");
    await expect(page.getByRole("heading", { name: "Requester Dashboard", exact: true })).toBeVisible();
    await expectAuthenticatedReads(page);
  });

  test("Empty Requester dashboard shows zero and safe role-only destinations", async ({ page }) => {
    const data = await dashboard(page, "requester", USERS.requester.email);
    expect(Object.values(data.counts)).toEqual([0, 0, 0, 0]);
    await expect(page.getByRole("button", { name: "Open Tickets: 0", exact: true })).toBeVisible();
    await expect(page.getByText(/No matching Tickets/)).toHaveCount(2);
    await expect(page.locator("#primary-navigation").getByRole("link", { name: "Ticket Queue" })).toHaveCount(0);
    expect(Object.values(data.lists).every(items => Array.isArray(items) && items.length === 0)).toBe(true);
    const response = await page.request.get("http://localhost:3000/api/staff/dashboard");
    expect(response.status()).toBe(403);
    expect((await response.json()).data).toBeUndefined();
    await expectAuthenticatedReads(page);
  });

  test("Staff mine filter matches server totals and Action21 opens current exact detail without writing", async ({ page }) => {
    const target = await fixture();
    const data = await dashboard(page, "staff", USERS.staff.email);
    const queueResponse = page.waitForResponse(response => {
      const url = new URL(response.url());
      return url.pathname === "/api/staff/queue" && url.searchParams.get("ownerScope") === "me";
    });
    await page.getByRole("button", { name: /My Tickets/ }).click();
    const queue = await queueResponse;
    expect((await queue.json()).pagination.totalItems).toBe(data.counts.myTickets);
    await navigate(page, "Dashboard");
    await expect(page.getByRole("heading", { name: "Staff Dashboard", exact: true })).toBeVisible();
    const reads = page.waitForResponse(response => response.url().endsWith(`/tickets/${target.ticketNumber}/actions/${target.selectedActionId}`) && response.request().method() === "GET");
    const writes: string[] = [];
    const record = (request: { method(): string; url(): string }) => { if (/POST|PATCH|DELETE/.test(request.method())) writes.push(request.url()); };
    page.on("request", record);
    const actionLink = page.getByRole("link", { name: new RegExp(`Action ${target.selectedActionId}.*${target.ticketNumber}`) }).first();
    for (let index = 0; index < 100 && !(await actionLink.evaluate(element => element === document.activeElement)); index++) await page.keyboard.press("Tab");
    await expect(actionLink).toBeFocused();
    await expect(actionLink).toHaveCSS("outline-style", "solid");
    await expect(actionLink).toHaveCSS("outline-width", "2px");
    expect(await page.locator(".dashboard-metric").evaluateAll(elements => elements.filter(element => element.tagName === "DIV").every(element => (element as HTMLElement).tabIndex < 0))).toBe(true);
    await page.keyboard.press("Enter");
    expect((await reads).status()).toBe(200);
    const selected = page.getByRole("region", { name: "Selected Action", exact: true });
    await expect(selected).toContainText(`${marker} Action 21`);
    await expect(selected).toBeFocused();
    await expect(page.locator("#primary-navigation").getByRole("link", { name: "Ticket Queue", exact: true, includeHidden: true })).toHaveAttribute("aria-current", "page");
    await expect(page.locator('form[aria-label="Edit Action"]')).toHaveCount(0);
    expect(writes).toEqual([]);
    page.off("request", record);
    await expectAuthenticatedReads(page);
  });

  test("Action21 remains editable when only the paginated Actions list fails and Retry never writes", async ({ page }) => {
    const target = await fixture();
    await dashboard(page, "staff", USERS.staff.email);
    let listReads = 0;
    await page.route(`**/api/tickets/${target.ticketNumber}/actions?*`, async route => {
      expect(route.request().method()).toBe("GET");
      listReads++;
      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: { code: "INTERNAL_ERROR", message: "List unavailable" } }) });
    });
    const writes: string[] = [];
    page.on("request", request => { if (["POST", "PATCH", "DELETE"].includes(request.method())) writes.push(request.url()); });
    const detail = page.waitForResponse(response => response.url().endsWith(`/tickets/${target.ticketNumber}/actions/${target.selectedActionId}`));
    await page.getByRole("link", { name: new RegExp(`Action ${target.selectedActionId}.*${target.ticketNumber}`) }).first().click();
    expect((await detail).status()).toBe(200);
    const selected = page.getByRole("region", { name: "Selected Action", exact: true });
    await expect(selected).toContainText(`${marker} Action 21`);
    await expect(page.getByRole("button", { name: "Retry", exact: true })).toBeVisible();
    await expect(page.getByRole("form", { name: "Edit Action" })).toHaveCount(0);
    await selected.getByRole("button", { name: "Edit Action", exact: true }).click();
    const form = page.getByRole("form", { name: "Edit Action" });
    await expect(form).toBeVisible();
    await expect(form.getByLabel(/Description/)).toHaveValue(`${marker} Action 21`);
    await form.getByLabel(/Description/).fill("Draft survives list Retry");
    const readsBefore = listReads;
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    await expect.poll(() => listReads).toBe(readsBefore + 1);
    await expect(page.getByRole("button", { name: "Retry", exact: true })).toBeVisible();
    await expect(form.getByLabel(/Description/)).toHaveValue("Draft survives list Retry");
    expect(writes).toEqual([]);
    await expectAuthenticatedReads(page);
  });

  test("Administrator reuses staff metrics while retaining User Management navigation", async ({ page }) => {
    await fixture();
    const data = await dashboard(page, "staff", USERS.admin.email);
    expect(Object.keys(data.counts.byStatus)).toHaveLength(8);
    expect(Object.keys(data.counts.byPriority)).toHaveLength(3);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const screenshotDirectory = path.resolve("artifacts/lab-04/screenshots/admin-dashboard");
    mkdirSync(screenshotDirectory, {recursive:true});
    await page.screenshot({path:path.join(screenshotDirectory,`${test.info().project.name}-dashboard.png`),fullPage:true});
    await expect(page.locator("#primary-navigation").getByRole("link", { includeHidden: true })).toHaveText(["Dashboard", "Ticket Queue", "User Management"]);
    await navigate(page, "User Management");
    await expect(page.getByRole("heading", { name: "User Management", exact: true })).toBeVisible();
    await navigate(page, "Dashboard");
    await expect(page.getByRole("heading", { name: "Staff Dashboard", exact: true })).toBeVisible();
    await expectAuthenticatedReads(page);
  });
});
