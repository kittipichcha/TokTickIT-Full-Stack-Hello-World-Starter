import { test, expect } from "@playwright/test";
import { USERS, createRequesterTicket, login, navigate, resetAccount } from "../lab-03/helpers";

// HARDEN-01: healthy journeys only. Injected-failure coverage stays in its canonical suites.
for (const role of ["requester", "staff", "admin"] as const) {
  test(`HARDEN-01 ${role}: primary navigation and existing detail controls remain functional`, async ({ page }) => {
    test.setTimeout(90_000);
    await resetAccount("requester");
    await resetAccount(role);
    const errors: string[] = [];
    const expectedBootstrapDiagnostics: string[] = [];
    let unauthenticated = true;
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => {
      if (message.type() !== "error") return;
      // Chromium reports the exact unauthenticated bootstrap response as a transport error.
      if (unauthenticated && new URL(message.location().url || "http://invalid").pathname === "/api/auth/me" && /401/.test(message.text())) {
        expectedBootstrapDiagnostics.push(message.text());
      } else errors.push(message.text());
    });
    page.on("response", async response => {
      const url = new URL(response.url());
      if (!url.pathname.startsWith("/api/") || response.status() < 400) return;
      if (unauthenticated && url.pathname === "/api/auth/me" && response.status() === 401 && response.request().method() === "GET") {
        const body = await response.json();
        if (body.error?.code === "UNAUTHENTICATED") return;
      }
      errors.push(`${response.request().method()} ${url.pathname}: ${response.status()}`);
    });
    page.on("requestfailed", request => {
      if (new URL(request.url()).pathname.startsWith("/api/")) errors.push(`${request.url()}: ${request.failure()?.errorText}`);
    });
    async function healthyScreen(active: string) {
      await expect(page.locator("#primary-navigation").getByRole("link", { name: active, exact: true, includeHidden: true })).toHaveAttribute("aria-current", "page");
      await expect(page.getByText(/^(Coming soon|Not implemented|TODO|TBD)[.!]?$/)).toHaveCount(0);
      const hamburger = page.locator(".hamburger");
      if (await hamburger.isVisible()) await expect(hamburger).toHaveAttribute("aria-expanded", "false");
      // Only known boundaries and actual validation/eligibility reasons explain a disabled control.
      for (const control of await page.locator("button:disabled").all()) {
        const explanation = await control.evaluate(node => {
          const label = node.textContent?.trim() ?? "";
          const section = node.closest("section");
          const form = node.closest("form");
          const context = node.closest("nav,.pagination,.pagination-controls,section,main")?.textContent ?? "";
          if (/^(Previous|Next)$/.test(label) && /Page\s+\d+\s+of\s+\d+/.test(context)) return "documented page boundary";
          const pagination = node.closest(".pagination-footer");
          if (/^(Previous|Next)$/.test(label) && pagination?.querySelector(".pagination-page.active") && /Showing\s+\d+[–-]\d+\s+of\s+\d+/.test(pagination.textContent ?? "")) return "visible Ticket-list page boundary";
          if (/^Post (Comment|Note)$/.test(label) && form) {
            const text = form.querySelector("textarea")?.value.trim() ?? "";
            if (text.length === 0 || text.length > 2000) return "comment/note validation with visible length counter";
          }
          if (label === "Save priority") {
            const selected = section?.querySelector<HTMLSelectElement>("#it-priority-select")?.value;
            const currentRow = [...document.querySelectorAll(".ticket-info-row")].find(row => row.querySelector(".ticket-info-label")?.textContent?.trim() === "IT Priority");
            const current = currentRow?.querySelector(".priority-badge")?.textContent?.trim() ?? "";
            if (selected === "" || selected === current) return "no unsaved IT Priority change";
          }
          if (label === "Assign" && section?.querySelector<HTMLSelectElement>("#owner-select")?.value === "") return "no owner selected";
          if (label === "Claimed by you") return "already owned by this actor";
          if (/^(Open|In Progress|Resolved|Closed|Cancelled|Reopened|Waiting for Requester)$/.test(label) && section?.textContent?.includes("Claim or assign this ticket before changing its status.")) return "unowned Ticket eligibility guidance";
          return "";
        });
        expect(explanation, `Unexplained disabled control: ${await control.innerText()}`).not.toBe("");
      }
    }
    async function signIn(email: string) {
      await login(page, email);
      unauthenticated = false;
    }
    async function logout() {
      unauthenticated = true;
      await page.getByRole("button", { name: "Logout", exact: true }).click();
      await expect(page.getByRole("button", { name: "Login", exact: true })).toBeVisible();
    }
    await signIn(USERS.requester.email);
    const summary = `Issue 55 ${role} navigation ${Date.now()}`;
    const ticketNumber = await createRequesterTicket(page, summary);
    if (role !== "requester") { await logout(); await signIn(USERS[role].email); }
    await navigate(page, "Dashboard");
    await expect(page.getByRole("heading", { name: role === "requester" ? "Requester Dashboard" : "Staff Dashboard", exact: true })).toBeVisible();
    await healthyScreen("Dashboard");
    const destination = role === "requester" ? "My Tickets" : "Ticket Queue";
    await navigate(page, destination);
    await expect(page.getByRole("searchbox", { name: "Search tickets" })).toBeVisible();
    await healthyScreen(destination);
    await page.getByLabel("Search tickets").fill(summary);
    if (role === "requester") await page.getByRole("link", { name: ticketNumber, exact: true }).click();
    else await page.getByRole("button", { name: "Open Detail", exact: true }).click();
    await expect(page.getByRole("heading", { name: new RegExp(`^${ticketNumber} `) })).toBeVisible();
    await healthyScreen(destination);
    for (const heading of ["Public Comments", "Attachments", "Actions Taken"]) await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    if (role !== "requester") {
      await page.getByRole("button", { name: "View status history", exact: true }).click();
      for (const heading of ["Internal Notes", "Status history"]) await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Add Action", exact: true })).toBeEnabled();
    }
    await page.getByRole("link", { name: role === "requester" ? "← Back to My Tickets" : "← Back to Queue", exact: true }).click();
    await expect(page.getByRole("searchbox", { name: "Search tickets" })).toBeVisible();
    await healthyScreen(destination);
    if (role === "requester") {
      await navigate(page, "Create Ticket");
      const another = page.getByRole("button", { name: "Create Another", exact: true });
      if (await another.isVisible()) await another.click();
      await expect(page.locator("#summary")).toBeVisible();
      await healthyScreen("Create Ticket");
    }
    if (role === "admin") {
      await navigate(page, "User Management");
      await expect(page.getByRole("heading", { name: "User Management", exact: true })).toBeVisible();
      await healthyScreen("User Management");
    }
    await navigate(page, "Dashboard");
    await healthyScreen("Dashboard");
    await logout();
    test.info().annotations.push({ type: "expected-bootstrap-diagnostics", description: JSON.stringify(expectedBootstrapDiagnostics) });
    expect(errors).toEqual([]);
  });
}
