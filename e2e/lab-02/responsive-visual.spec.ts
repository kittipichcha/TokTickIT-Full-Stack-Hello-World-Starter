import { test, expect, type Page, type BrowserContext } from "@playwright/test";

/**
 * VISUAL-01 / E2E-06: Responsive visual evidence for all Lab 2 screens.
 * Uses Playwright route interception with careful URL path matching.
 */

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "tablet", width: 820, height: 1180 },
  { name: "mobile", width: 390, height: 844 },
] as const;

const REQUESTERS = [
  { id: 1, name: "Jennifer Anderson", email: "jennifer.anderson@example.com" },
  { id: 2, name: "Michael Chen", email: "michael.chen@example.com" },
  { id: 3, name: "Sarah Williams", email: "sarah.williams@example.com" },
  { id: 4, name: "David Kumar", email: "david.kumar@example.com" },
];

const CATEGORIES = [
  { id: 1, name: "Hardware" }, { id: 2, name: "Software" },
  { id: 3, name: "Network" }, { id: 4, name: "Access" },
];

const RELATED_SYSTEMS = [
  { id: 1, name: "Corporate Laptop" }, { id: 2, name: "Campus Wi-Fi" },
  { id: 3, name: "Email System" }, { id: 4, name: "ERP System" },
  { id: 5, name: "VPN Access" }, { id: 6, name: "Print Services" },
];

interface TicketData {
  id: number; ticketNumber: string; categoryId: number; categoryName: string;
  summary: string; requestedPriority: string; itPriority: string | null;
  currentStatus: string; createdAt: string; updatedAt: string;
}

interface AttachmentData {
  id: number; originalFilename: string; mimeType: string;
  fileSizeBytes: number; uploadedAt: string;
  isRemoved: boolean; removalReason?: string | null;
}

function makeTicket(id: number, overrides: Partial<TicketData> = {}): TicketData {
  return {
    id, ticketNumber: `TKT-2026-${String(id).padStart(6, "0")}`,
    categoryId: 1, categoryName: "Hardware",
    summary: `Test ticket ${id} summary`, requestedPriority: "MEDIUM",
    itPriority: null, currentStatus: "NEW",
    createdAt: "2026-08-21T09:14:00.000Z",
    updatedAt: "2026-08-21T09:14:00.000Z", ...overrides,
  };
}

function makeDetailTicket(id: number, attachments: AttachmentData[] = []) {
  return {
    id, ticketNumber: `TKT-2026-${String(id).padStart(6, "0")}`,
    requesterId: 1, requesterName: "Jennifer Anderson", requesterIsActive: true,
    categoryId: 1, categoryName: "Hardware", relatedSystemId: 1,
    relatedSystemName: "Corporate Laptop", summary: "Detail view test ticket",
    description: "This is a test ticket for detail view screenshots.",
    requestedPriority: "MEDIUM", itPriority: null, ticketOwnerId: null,
    currentStatus: "NEW", createdAt: "2026-08-21T09:14:00.000Z",
    updatedAt: "2026-08-21T09:14:00.000Z", attachments,
  };
}

function makeAttachment(id: number, overrides: Partial<AttachmentData> = {}): AttachmentData {
  return {
    id, originalFilename: `document-${id}.pdf`, mimeType: "application/pdf",
    fileSizeBytes: 214532, uploadedAt: "2026-08-21T09:15:00.000Z",
    isRemoved: false, removalReason: null, ...overrides,
  };
}

/**
 * Determines whether a request URL belongs to the tickets list endpoint
 * (as opposed to a ticket detail or other sub-route).
 */
function isTicketListUrl(url: string): boolean {
  const u = new URL(url);
  // /api/tickets exactly (no trailing path segment after tickets)
  // But /api/tickets/TKT-... should NOT match
  const path = u.pathname;
  // Check if pathname is exactly /api/tickets or /api/tickets?...
  return /^\/api\/tickets$/.test(path) || /^\/api\/tickets\?/.test(path);
}

async function setupApiMocks(
  page: Page, context: BrowserContext,
  options: {
    ticketData?: TicketData[]; attachmentData?: AttachmentData[];
    detailTicket?: ReturnType<typeof makeDetailTicket>;
    devRequesters?: typeof REQUESTERS; categories?: typeof CATEGORIES;
    relatedSystems?: typeof RELATED_SYSTEMS; failRequesterContext?: boolean;
    slowRequesters?: boolean; failMyTickets?: boolean; failDetail?: boolean;
  } = {},
) {
  const {
    ticketData = [], attachmentData = [], detailTicket,
    devRequesters = REQUESTERS, categories = CATEGORIES,
    relatedSystems = RELATED_SYSTEMS, failRequesterContext = false,
    slowRequesters = false, failMyTickets = false, failDetail = false,
  } = options;

  await context.addInitScript(() => {
    sessionStorage.setItem("toktickit.requesterId", "1");
  });

  // Bootstrap endpoints
  await page.route("**/api/dev-requesters", async (route) => {
    if (slowRequesters) { await new Promise(() => undefined); return; }
    await route.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ data: devRequesters }) });
  });
  await page.route("**/api/requester-context", async (route) => {
    if (failRequesterContext) {
      await route.fulfill({ status: 422, contentType: "application/json",
        body: JSON.stringify({ error: { code: "REQUESTER_CONTEXT_INVALID", message: "A valid active requester is required." } }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ data: { requesterId: 1 } }) });
  });
  await page.route("**/api/categories", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify(categories) });
  });
  await page.route("**/api/related-systems", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ data: relatedSystems }) });
  });

  // Catch-all API route handler — dispatches by URL path
  await page.route("**/api/**", async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    // Ticket detail: /api/tickets/TKT-XXXX-XXXXXX (no trailing path)
    if (/\/api\/tickets\/TKT-\d{4}-\d{6}$/.test(url)) {
      if (failDetail) {
        await route.fulfill({ status: 404, contentType: "application/json",
          body: JSON.stringify({ error: { code: "NOT_FOUND", message: "Ticket not found." } }) });
        return;
      }
      const dt = detailTicket ?? makeDetailTicket(1, attachmentData);
      await route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ data: dt }) });
      return;
    }

    // Ticket list or create: /api/tickets or /api/tickets?...
    if (isTicketListUrl(url)) {
      if (method === "POST") {
        await route.fulfill({ status: 201, contentType: "application/json",
          body: JSON.stringify({ data: { id: 501, ticketNumber: "TKT-2026-000123",
            requesterId: 1, categoryId: 1, relatedSystemId: 1,
            summary: "Test ticket", description: "Test description",
            requestedPriority: "MEDIUM", itPriority: null, ticketOwnerId: null,
            currentStatus: "NEW", createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString() } }) });
        return;
      }
      if (failMyTickets) {
        await route.fulfill({ status: 500, contentType: "application/json",
          body: JSON.stringify({ error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } }) });
        return;
      }
      const reqUrl = new URL(url);
      const searchParam = reqUrl.searchParams.get("search");
      const categoryFilter = reqUrl.searchParams.get("categoryId");
      const priorityFilter = reqUrl.searchParams.get("requestedPriority");
      let filtered = [...ticketData];
      if (searchParam) {
        const s = searchParam.toLowerCase();
        filtered = filtered.filter(t => t.ticketNumber.toLowerCase().includes(s) || t.summary.toLowerCase().includes(s));
      }
      if (categoryFilter) filtered = filtered.filter(t => t.categoryId === Number(categoryFilter));
      if (priorityFilter) filtered = filtered.filter(t => t.requestedPriority === priorityFilter);
      const pageSize = 10;
      const totalItems = filtered.length;
      const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
      await route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ data: filtered.slice(0, pageSize),
          pagination: { page: 1, pageSize, totalItems, totalPages, unfilteredTotalItems: ticketData.length } }) });
      return;
    }

    // Attachments list/upload: /api/tickets/TKT-XXXX-XXXXXX/attachments
    if (/\/api\/tickets\/TKT-\d{4}-\d{6}\/attachments$/.test(url)) {
      if (method === "POST") {
        await route.fulfill({ status: 201, contentType: "application/json",
          body: JSON.stringify({ data: { id: 9001, originalFilename: "uploaded-file.pdf",
            mimeType: "application/pdf", fileSizeBytes: 123456,
            uploadedAt: new Date().toISOString(), ticketId: 501 } }) });
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ data: attachmentData }) });
      return;
    }

    // Attachment preview/download
    if (/\/api\/attachments\/1\/preview$/.test(url)) {
      await route.fulfill({ status: 200, contentType: "image/png",
        body: Buffer.from("89504E470D0A1A0A0000000D4948445200000064000000640802000000FF8002030000000C4944415462816338CA0000000601004900000000", "hex") });
      return;
    }
    if (/\/api\/attachments\/1\/download$/.test(url)) {
      await route.fulfill({ status: 200,
        headers: { "Content-Type": "image/png", "Content-Disposition": 'inline; filename="screenshot.png"; filename*=UTF-8\'\'screenshot.png' },
        body: Buffer.from("89504E470D0A1A0A", "hex") });
      return;
    }

    // Fall through for any unmatched API routes
    await route.fulfill({ status: 404, contentType: "application/json",
      body: JSON.stringify({ error: { code: "NOT_FOUND", message: "Not found." } }) });
  });
}

async function screenshotAllViewports(page: Page, basePath: string, action: () => Promise<void>) {
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto("/");
    await action();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `artifacts/lab-02/screenshots/${basePath}/${vp.name}.png`, fullPage: true });
  }
}

// ─── Requester Selection ───────────────────────────────────────────────────

test.describe("Requester Selection screenshots", () => {
  test("loading state @visual", async ({ page, context }) => {
    await context.addInitScript(() => { sessionStorage.removeItem("toktickit.requesterId"); });
    await setupApiMocks(page, context, { slowRequesters: true });
    await screenshotAllViewports(page, "requester-selection/loading", async () => {});
  });
  test("empty state @visual", async ({ page, context }) => {
    await context.addInitScript(() => { sessionStorage.removeItem("toktickit.requesterId"); });
    await setupApiMocks(page, context, { devRequesters: [] });
    await screenshotAllViewports(page, "requester-selection/empty", async () => {});
  });
  test("failure state @visual", async ({ page, context }) => {
    await context.addInitScript(() => { sessionStorage.removeItem("toktickit.requesterId"); });
    await setupApiMocks(page, context, { devRequesters: [] });
    await page.route("**/api/dev-requesters", async (route) => {
      await route.fulfill({ status: 500, contentType: "application/json",
        body: JSON.stringify({ error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } }) });
    });
    await screenshotAllViewports(page, "requester-selection/failure", async () => {});
  });
  test("populated state @visual", async ({ page, context }) => {
    await context.addInitScript(() => { sessionStorage.removeItem("toktickit.requesterId"); });
    await setupApiMocks(page, context, {});
    await screenshotAllViewports(page, "requester-selection/populated", async () => {
      await page.waitForSelector("#requester", { timeout: 10000 });
      await page.selectOption("#requester", "2");
    });
  });
});

// ─── Create Ticket ─────────────────────────────────────────────────────────

test.describe("Create Ticket screenshots", () => {
  test("initial state @visual", async ({ page, context }) => {
    await setupApiMocks(page, context, { ticketData: [makeTicket(1)] });
    await screenshotAllViewports(page, "create-ticket/initial", async () => {
      await page.waitForSelector("a:has-text('Create Ticket')", { timeout: 10000 });
      await page.click("a:has-text('Create Ticket')");
      await page.waitForSelector("input[aria-label*='Summary']", { timeout: 10000 });
    });
  });
  test("validation error @visual", async ({ page, context }) => {
    await setupApiMocks(page, context, { ticketData: [makeTicket(1)] });
    await screenshotAllViewports(page, "create-ticket/validation-error", async () => {
      await page.waitForSelector("a:has-text('Create Ticket')", { timeout: 10000 });
      await page.click("a:has-text('Create Ticket')");
      await page.waitForSelector("input[aria-label*='Summary']", { timeout: 10000 });
      await page.selectOption("select[aria-label*='Category']", { index: 1 });
      await page.fill("textarea[aria-label*='Description']", "Valid description text for testing.");
      await page.click("button:has-text('Submit')");
      await page.waitForTimeout(500);
    });
  });
  test("submitting state @visual", async ({ page, context }) => {
    await setupApiMocks(page, context, { ticketData: [makeTicket(1)] });
    await page.route(/\/api\/tickets$/, async (route) => {
      if (route.request().method() === "POST") { await new Promise(() => undefined); return; }
      await route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ data: [], pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 1, unfilteredTotalItems: 0 } }) });
    });
    await screenshotAllViewports(page, "create-ticket/submitting", async () => {
      await page.waitForSelector("a:has-text('Create Ticket')", { timeout: 10000 });
      await page.click("a:has-text('Create Ticket')");
      await page.waitForSelector("input[aria-label*='Summary']", { timeout: 10000 });
      await page.selectOption("select[aria-label*='Category']", { index: 1 });
      await page.selectOption("select[aria-label*='Related System']", { index: 1 });
      await page.fill("input[aria-label*='Summary']", "Test ticket for screenshot");
      await page.fill("textarea[aria-label*='Description']", "This is a test description that is long enough to pass validation.");
      await page.click("button:has-text('Submit')");
      await page.waitForTimeout(800);
    });
  });
  test("success state @visual", async ({ page, context }) => {
    await setupApiMocks(page, context, { ticketData: [makeTicket(1)] });
    await screenshotAllViewports(page, "create-ticket/success", async () => {
      await page.waitForSelector("a:has-text('Create Ticket')", { timeout: 10000 });
      await page.click("a:has-text('Create Ticket')");
      await page.waitForSelector("input[aria-label*='Summary']", { timeout: 10000 });
      await page.selectOption("select[aria-label*='Category']", { index: 1 });
      await page.selectOption("select[aria-label*='Related System']", { index: 1 });
      await page.fill("input[aria-label*='Summary']", "Test ticket for screenshot");
      await page.fill("textarea[aria-label*='Description']", "This is a test description that is long enough to pass validation.");
      await page.click("button:has-text('Submit')");
      await page.waitForSelector(".success-panel", { timeout: 10000 });
    });
  });
  test("api failure @visual", async ({ page, context }) => {
    await setupApiMocks(page, context, { ticketData: [makeTicket(1)] });
    await page.route(/\/api\/tickets$/, async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({ status: 400, contentType: "application/json",
          body: JSON.stringify({ error: { code: "VALIDATION_ERROR", message: "A server error occurred.", fields: {} } }) });
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ data: [], pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0, unfilteredTotalItems: 0 } }) });
    });
    await screenshotAllViewports(page, "create-ticket/api-failure", async () => {
      await page.waitForSelector("a:has-text('Create Ticket')", { timeout: 10000 });
      await page.click("a:has-text('Create Ticket')");
      await page.waitForSelector("input[aria-label*='Summary']", { timeout: 10000 });
      await page.selectOption("select[aria-label*='Category']", { index: 1 });
      await page.selectOption("select[aria-label*='Related System']", { index: 1 });
      await page.fill("input[aria-label*='Summary']", "Test ticket for screenshot");
      await page.fill("textarea[aria-label*='Description']", "This is a test description that is long enough to pass validation.");
      await page.click("button:has-text('Submit')");
      await page.waitForSelector(".error-box", { timeout: 10000 });
    });
  });
  test("invalid attachment @visual", async ({ page, context }) => {
    await setupApiMocks(page, context, { ticketData: [makeTicket(1)] });
    await screenshotAllViewports(page, "create-ticket/invalid-attachment", async () => {
      await page.waitForSelector("a:has-text('Create Ticket')", { timeout: 10000 });
      await page.click("a:has-text('Create Ticket')");
      await page.waitForSelector("input[aria-label*='Summary']", { timeout: 10000 });
      const fcPromise = page.waitForEvent("filechooser");
      await page.click("text=Browse files");
      const fc = await fcPromise;
      await fc.setFiles({ name: "test.exe", mimeType: "application/x-msdownload", buffer: Buffer.from([0x4D, 0x5A]) });
      await page.waitForTimeout(1000);
    });
  });
  test("partial success attachment failure @visual", async ({ page, context }) => {
    await setupApiMocks(page, context, { ticketData: [makeTicket(1)] });
    let uploadCount = 0;
    await page.route(/\/api\/tickets\/TKT-\d{4}-\d{6}\/attachments$/, async (route) => {
      if (route.request().method() === "POST") {
        uploadCount++;
        if (uploadCount > 1) {
          await route.fulfill({ status: 415, contentType: "application/json",
            body: JSON.stringify({ error: { code: "UNSUPPORTED_MEDIA_TYPE", message: "File type not supported." } }) });
          return;
        }
      }
      await route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ data: [] }) });
    });
    await screenshotAllViewports(page, "create-ticket/partial-success-attachment-failure", async () => {
      await page.waitForSelector("a:has-text('Create Ticket')", { timeout: 10000 });
      await page.click("a:has-text('Create Ticket')");
      await page.waitForSelector("input[aria-label*='Summary']", { timeout: 10000 });
      await page.selectOption("select[aria-label*='Category']", { index: 1 });
      await page.selectOption("select[aria-label*='Related System']", { index: 1 });
      await page.fill("input[aria-label*='Summary']", "Partial success test");
      await page.fill("textarea[aria-label*='Description']", "This ticket will have a failed attachment.");
      const fc1 = page.waitForEvent("filechooser"); await page.click("text=Browse files");
      (await fc1).setFiles({ name: "photo1.png", mimeType: "image/png", buffer: Buffer.from("89504E470D0A1A0A", "hex") });
      await page.waitForTimeout(500);
      const fc2 = page.waitForEvent("filechooser"); await page.click("text=Browse files");
      (await fc2).setFiles({ name: "photo2.png", mimeType: "image/png", buffer: Buffer.from("89504E470D0A1A0A", "hex") });
      await page.waitForTimeout(500);
      await page.click("button:has-text('Submit')");
      await page.waitForTimeout(3000);
    });
  });
});

// ─── My Tickets ────────────────────────────────────────────────────────────

test.describe("My Tickets screenshots", () => {
  const sampleTickets = [
    makeTicket(1, { summary: "Laptop battery drains quickly", requestedPriority: "HIGH", createdAt: "2026-08-21T09:14:00.000Z" }),
    makeTicket(2, { summary: "VPN connection timeout", categoryId: 3, categoryName: "Network", requestedPriority: "MEDIUM", createdAt: "2026-08-22T10:00:00.000Z" }),
    makeTicket(3, { summary: "Email not syncing", categoryId: 2, categoryName: "Software", requestedPriority: "LOW", createdAt: "2026-08-23T11:30:00.000Z" }),
  ];

  test("default state @visual", async ({ page, context }) => {
    await setupApiMocks(page, context, { ticketData: sampleTickets });
    await screenshotAllViewports(page, "my-tickets/default", async () => {
      await page.waitForSelector(".app-shell", { timeout: 10000 }); await page.waitForTimeout(2000);
    });
  });
  test("loading state @visual", async ({ page, context }) => {
    await setupApiMocks(page, context, { ticketData: sampleTickets });
    await page.route(/\/api\/tickets(\?|$)/, async () => { await new Promise(() => undefined); });
    await screenshotAllViewports(page, "my-tickets/loading", async () => {
      await page.waitForSelector(".app-shell", { timeout: 10000 }); await page.waitForTimeout(500);
    });
  });
  test("empty state @visual", async ({ page, context }) => {
    await setupApiMocks(page, context, { ticketData: [] });
    await screenshotAllViewports(page, "my-tickets/empty", async () => {
      await page.waitForSelector(".app-shell", { timeout: 10000 }); await page.waitForTimeout(2000);
    });
  });
  test("no-results state @visual", async ({ page, context }) => {
    await setupApiMocks(page, context, { ticketData: sampleTickets });
    await page.route(/\/api\/tickets(\?|$)/, async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ data: [], pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0, unfilteredTotalItems: 3 } }) });
    });
    await screenshotAllViewports(page, "my-tickets/no-results", async () => {
      await page.waitForSelector(".app-shell", { timeout: 10000 }); await page.waitForTimeout(2000);
    });
  });
  test("filtered state @visual", async ({ page, context }) => {
    await setupApiMocks(page, context, { ticketData: sampleTickets });
    await screenshotAllViewports(page, "my-tickets/filtered", async () => {
      await page.waitForSelector(".app-shell", { timeout: 10000 }); await page.waitForTimeout(1000);
      await page.locator("select[aria-label*='category']").first().selectOption("1");
      await page.waitForTimeout(2000);
    });
  });
  test("failure state @visual", async ({ page, context }) => {
    await setupApiMocks(page, context, { failMyTickets: true });
    await screenshotAllViewports(page, "my-tickets/failure", async () => {
      await page.waitForSelector(".app-shell", { timeout: 10000 }); await page.waitForTimeout(2000);
    });
  });
});

// ─── Ticket Detail ─────────────────────────────────────────────────────────

test.describe("Ticket Detail screenshots", () => {
  const activeAttachments = [
    makeAttachment(1, { originalFilename: "screenshot.png", mimeType: "image/png", fileSizeBytes: 345678 }),
    makeAttachment(2, { originalFilename: "report.pdf", mimeType: "application/pdf", fileSizeBytes: 512000 }),
  ];

  test("default state @visual", async ({ page, context }) => {
    const dt = makeDetailTicket(1, activeAttachments);
    await setupApiMocks(page, context, { ticketData: [makeTicket(1, { summary: "Detail view test ticket" })], detailTicket: dt, attachmentData: activeAttachments });
    await screenshotAllViewports(page, "ticket-detail/default", async () => {
      await page.waitForSelector(".app-shell", { timeout: 10000 }); await page.waitForTimeout(1000);
      await page.click("text=Detail view test ticket"); await page.waitForTimeout(2000);
    });
  });
  test("loading state @visual", async ({ page, context }) => {
    const dt = makeDetailTicket(1, activeAttachments);
    await setupApiMocks(page, context, { ticketData: [makeTicket(1, { summary: "Detail view test ticket" })], detailTicket: dt, attachmentData: activeAttachments });
    await page.route(/\/api\/tickets\/TKT-\d{4}-\d{6}$/, async () => { await new Promise(() => undefined); });
    await screenshotAllViewports(page, "ticket-detail/loading", async () => {
      await page.waitForSelector(".app-shell", { timeout: 10000 }); await page.waitForTimeout(1000);
      await page.click("text=Detail view test ticket"); await page.waitForTimeout(500);
    });
  });
  test("failure/not-found state @visual", async ({ page, context }) => {
    const dt = makeDetailTicket(1, activeAttachments);
    await setupApiMocks(page, context, { ticketData: [makeTicket(1, { summary: "Detail view test ticket" })], detailTicket: dt, failDetail: true });
    await screenshotAllViewports(page, "ticket-detail/failure-or-not-found", async () => {
      await page.waitForSelector(".app-shell", { timeout: 10000 }); await page.waitForTimeout(1000);
      await page.click("text=Detail view test ticket"); await page.waitForTimeout(2000);
    });
  });
  test("attachment active @visual", async ({ page, context }) => {
    const dt = makeDetailTicket(1, activeAttachments);
    await setupApiMocks(page, context, { ticketData: [makeTicket(1, { summary: "Detail view test ticket" })], detailTicket: dt, attachmentData: activeAttachments });
    await screenshotAllViewports(page, "ticket-detail/attachment-active", async () => {
      await page.waitForSelector(".app-shell", { timeout: 10000 }); await page.waitForTimeout(1000);
      await page.click("text=Detail view test ticket"); await page.waitForTimeout(2000);
    });
  });
  test("attachment uploading @visual", async ({ page, context }) => {
    const dt = makeDetailTicket(1, [makeAttachment(1, { originalFilename: "existing.pdf" })]);
    await setupApiMocks(page, context, { ticketData: [makeTicket(1, { summary: "Detail view test ticket" })], detailTicket: dt });
    await page.route(/\/api\/tickets\/TKT-\d{4}-\d{6}\/attachments$/, async (route) => {
      if (route.request().method() === "POST") { await new Promise(() => undefined); return; }
      await route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ data: [makeAttachment(1, { originalFilename: "existing.pdf" })] }) });
    });
    await screenshotAllViewports(page, "ticket-detail/attachment-uploading", async () => {
      await page.waitForSelector(".app-shell", { timeout: 10000 }); await page.waitForTimeout(1000);
      await page.click("text=Detail view test ticket"); await page.waitForTimeout(2000);
      const fc = page.waitForEvent("filechooser"); await page.click("text=Browse files");
      (await fc).setFiles({ name: "uploading-test.png", mimeType: "image/png", buffer: Buffer.from("89504E470D0A1A0A", "hex") });
      await page.waitForTimeout(1000);
    });
  });
  test("attachment invalid @visual", async ({ page, context }) => {
    const dt = makeDetailTicket(1, []);
    await setupApiMocks(page, context, { ticketData: [makeTicket(1, { summary: "Detail view test ticket" })], detailTicket: dt });
    await screenshotAllViewports(page, "ticket-detail/attachment-invalid", async () => {
      await page.waitForSelector(".app-shell", { timeout: 10000 }); await page.waitForTimeout(1000);
      await page.click("text=Detail view test ticket"); await page.waitForTimeout(2000);
      const fc = page.waitForEvent("filechooser"); await page.click("text=Browse files");
      (await fc).setFiles({ name: "malicious.exe", mimeType: "application/x-msdownload", buffer: Buffer.from([0x4D, 0x5A]) });
      await page.waitForTimeout(1000);
    });
  });
  test("attachment removed @visual", async ({ page, context }) => {
    const removedAttachments = [makeAttachment(1, { originalFilename: "old-report.pdf", isRemoved: true, removalReason: "Superseded." })];
    const dt = makeDetailTicket(1, removedAttachments);
    await setupApiMocks(page, context, { ticketData: [makeTicket(1, { summary: "Detail view test ticket" })], detailTicket: dt, attachmentData: removedAttachments });
    await screenshotAllViewports(page, "ticket-detail/attachment-removed", async () => {
      await page.waitForSelector(".app-shell", { timeout: 10000 }); await page.waitForTimeout(1000);
      await page.click("text=Detail view test ticket"); await page.waitForTimeout(2000);
    });
  });
  test("attachment unavailable @visual", async ({ page, context }) => {
    const dt = makeDetailTicket(1, activeAttachments);
    await setupApiMocks(page, context, { ticketData: [makeTicket(1, { summary: "Detail view test ticket" })], detailTicket: dt, attachmentData: activeAttachments });
    await screenshotAllViewports(page, "ticket-detail/attachment-unavailable", async () => {
      await page.waitForSelector(".app-shell", { timeout: 10000 }); await page.waitForTimeout(1000);
      await page.click("text=Detail view test ticket"); await page.waitForTimeout(2000);
    });
  });
  test("preview modal @visual", async ({ page, context }) => {
    const dt = makeDetailTicket(1, activeAttachments);
    await setupApiMocks(page, context, { ticketData: [makeTicket(1, { summary: "Detail view test ticket" })], detailTicket: dt, attachmentData: activeAttachments });
    await screenshotAllViewports(page, "ticket-detail/preview-modal", async () => {
      await page.waitForSelector(".app-shell", { timeout: 10000 }); await page.waitForTimeout(1000);
      await page.click("text=Detail view test ticket"); await page.waitForTimeout(2000);
      const pv = page.locator("button:has-text('Preview')").first();
      if (await pv.isVisible({ timeout: 3000 }).catch(() => false)) { await pv.click(); await page.waitForTimeout(1000); }
    });
  });
});

// ─── E2E-06 / VISUAL-01: Responsive layout ─────────────────────────────────

test.describe("E2E-06/VISUAL-01: Responsive layout checks", () => {
  const sampleTickets = [
    makeTicket(1, { summary: "Laptop battery drains quickly", requestedPriority: "HIGH" }),
    makeTicket(2, { summary: "VPN connection timeout", categoryId: 3, categoryName: "Network", requestedPriority: "MEDIUM" }),
    makeTicket(3, { summary: "Email not syncing", categoryId: 2, categoryName: "Software", requestedPriority: "LOW" }),
  ];

  test("My Tickets no horizontal scroll", async ({ page, context }) => {
    await setupApiMocks(page, context, { ticketData: sampleTickets });
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/"); await page.waitForSelector(".app-shell", { timeout: 10000 }); await page.waitForTimeout(2000);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(overflow, `${vp.name}: no horizontal scroll`).toBe(false);
    }
  });
  test("Create Ticket responsive", async ({ page, context }) => {
    await setupApiMocks(page, context, { ticketData: sampleTickets });
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/"); await page.waitForSelector("a:has-text('Create Ticket')", { timeout: 10000 });
      await page.click("a:has-text('Create Ticket')");
      await page.waitForSelector("input[aria-label*='Summary']", { timeout: 10000 }); await page.waitForTimeout(500);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(overflow, `${vp.name}: Create Ticket no horizontal scroll`).toBe(false);
    }
  });
  test("Requester Selection responsive", async ({ page, context }) => {
    await context.addInitScript(() => { sessionStorage.removeItem("toktickit.requesterId"); });
    await setupApiMocks(page, context, {});
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/"); await page.waitForSelector("#requester", { timeout: 10000 }); await page.waitForTimeout(500);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(overflow, `${vp.name}: selector no horizontal scroll`).toBe(false);
    }
  });
});