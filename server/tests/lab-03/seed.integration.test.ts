import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import bcrypt from "bcrypt";
import { getPrisma, disconnectPrisma } from "../../src/prisma.js";

const itIfDb = process.env.DATABASE_URL ? it : it.skip;

const serverRoot = fileURLToPath(new URL("../../", import.meta.url));

/** Seed-owned marker prefix (must match `server/prisma/seed.ts`). */
const SEED_MARKER_PREFIX = "[seed:";

/** Test-only marker so this suite's fixtures never collide with seed or app data. */
const TEST_MARKER = "SEEDTEST";

function runSeed(): void {
  execSync("npx tsx prisma/seed.ts", {
    cwd: serverRoot,
    stdio: "pipe",
    env: process.env,
  });
}

/** Canonical Lab 2 ticket-number contract: TKT-YYYY-NNNNNN (six-digit sequence). */
const CANONICAL_TICKET_NUMBER = /^TKT-\d{4}-\d{6}$/;

describe("SEED-01: Seed idempotency and full mandatory population", () => {
  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    await getPrisma().$queryRawUnsafe("SELECT 1");
  });

  afterAll(async () => {
    if (!process.env.DATABASE_URL) return;
    const prisma = getPrisma();
    // Remove this suite's own fixtures (never seed-owned or application data).
    await prisma.comment.deleteMany({ where: { content: { contains: TEST_MARKER } } });
    await prisma.internalNote.deleteMany({ where: { content: { contains: TEST_MARKER } } });
    await prisma.ticket.deleteMany({ where: { summary: { contains: TEST_MARKER } } });
    await disconnectPrisma();
  });

  itIfDb("runs twice with identical state and no errors", async () => {
    const prisma = getPrisma();

    runSeed();
    const counts1 = {
      requesters: await prisma.user.count({ where: { role: "REQUESTER" } }),
      staff: await prisma.user.count({ where: { role: "IT_STAFF" } }),
      admins: await prisma.user.count({ where: { role: "ADMINISTRATOR" } }),
      categories: await prisma.category.count(),
      systems: await prisma.relatedSystem.count(),
      tickets: await prisma.ticket.count(),
    };

    runSeed();
    const counts2 = {
      requesters: await prisma.user.count({ where: { role: "REQUESTER" } }),
      staff: await prisma.user.count({ where: { role: "IT_STAFF" } }),
      admins: await prisma.user.count({ where: { role: "ADMINISTRATOR" } }),
      categories: await prisma.category.count(),
      systems: await prisma.relatedSystem.count(),
      tickets: await prisma.ticket.count(),
    };

    expect(counts2).toEqual(counts1);
  }, 60000);

  itIfDb("populates the mandatory user population", async () => {
    const prisma = getPrisma();

    // >= 4 active + 1 inactive Requester.
    const activeRequesters = await prisma.user.count({ where: { role: "REQUESTER", isActive: true } });
    const inactiveRequesters = await prisma.user.count({ where: { role: "REQUESTER", isActive: false } });
    expect(activeRequesters).toBeGreaterThanOrEqual(4);
    expect(inactiveRequesters).toBeGreaterThanOrEqual(1);

    // >= 3 active + 1 inactive IT Staff.
    const activeStaff = await prisma.user.count({ where: { role: "IT_STAFF", isActive: true } });
    const inactiveStaff = await prisma.user.count({ where: { role: "IT_STAFF", isActive: false } });
    expect(activeStaff).toBeGreaterThanOrEqual(3);
    expect(inactiveStaff).toBeGreaterThanOrEqual(1);

    // >= 1 active Administrator.
    const activeAdmins = await prisma.user.count({ where: { role: "ADMINISTRATOR", isActive: true } });
    expect(activeAdmins).toBeGreaterThanOrEqual(1);

    // Preserved categories and related systems.
    expect(await prisma.category.count()).toBeGreaterThanOrEqual(4);
    expect(await prisma.relatedSystem.count()).toBeGreaterThanOrEqual(6);

    // Realistic tickets across statuses/priorities/ownership.
    const tickets = await prisma.ticket.findMany();
    expect(tickets.length).toBeGreaterThan(0);
    const statuses = new Set(tickets.map((t) => t.currentStatus));
    expect(statuses.size).toBeGreaterThan(1);

    // Example comments and internal notes.
    expect(await prisma.comment.count()).toBeGreaterThan(0);
    expect(await prisma.internalNote.count()).toBeGreaterThan(0);
  });
});

describe("SEED-TKT: canonical ticket-number contract", () => {
  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    runSeed();
  });

  afterAll(async () => {
    if (!process.env.DATABASE_URL) return;
    await disconnectPrisma();
  });

  itIfDb("SEED-TKT-01: every seed-owned ticket number uses the canonical six-digit format", async () => {
    const prisma = getPrisma();
    const seedTickets = await prisma.ticket.findMany({
      where: { description: { contains: SEED_MARKER_PREFIX } },
    });
    expect(seedTickets.length).toBeGreaterThan(0);
    for (const t of seedTickets) {
      expect(t.ticketNumber).toMatch(CANONICAL_TICKET_NUMBER);
    }
  });

  itIfDb("SEED-TKT-02: seed-owned ticket numbers are unique", async () => {
    const prisma = getPrisma();
    const seedTickets = await prisma.ticket.findMany({
      where: { description: { contains: SEED_MARKER_PREFIX } },
      select: { ticketNumber: true },
    });
    const numbers = seedTickets.map((t) => t.ticketNumber);
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  itIfDb("SEED-TKT-03: a second seed run does not renumber existing seed tickets", async () => {
    const prisma = getPrisma();
    const before = await prisma.ticket.findMany({
      where: { description: { contains: SEED_MARKER_PREFIX } },
      select: { id: true, ticketNumber: true },
      orderBy: { id: "asc" },
    });

    runSeed();

    const after = await prisma.ticket.findMany({
      where: { description: { contains: SEED_MARKER_PREFIX } },
      select: { id: true, ticketNumber: true },
      orderBy: { id: "asc" },
    });

    expect(after).toEqual(before);
  }, 60000);

  itIfDb("SEED-TKT-04: the seed participates in the canonical allocator sequence", async () => {
    const prisma = getPrisma();
    const { allocateTicketNumber } = await import("../../src/ticket-number.js");

    // A ticket created through the application allocator after seeding must receive the
    // NEXT canonical sequence value — proving the seed did not maintain a parallel counter.
    const allocated = await allocateTicketNumber(new Date().getUTCFullYear());
    expect(allocated).toMatch(CANONICAL_TICKET_NUMBER);

    const seedNumbers = await prisma.ticket.findMany({
      where: { description: { contains: SEED_MARKER_PREFIX } },
      select: { ticketNumber: true },
    });
    expect(seedNumbers.map((t) => t.ticketNumber)).not.toContain(allocated);
  });
});

describe("SEED-IDEMP: non-destructive reruns", () => {
  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    runSeed();
  });

  afterAll(async () => {
    if (!process.env.DATABASE_URL) return;
    await disconnectPrisma();
  });

  itIfDb("SEED-IDEMP-01: two seed runs produce no duplicate seed records", async () => {
    const prisma = getPrisma();

    const snapshot = async () => ({
      seedTickets: await prisma.ticket.count({ where: { description: { contains: SEED_MARKER_PREFIX } } }),
      comments: await prisma.comment.count(),
      notes: await prisma.internalNote.count(),
      users: await prisma.user.count(),
    });

    const before = await snapshot();
    runSeed();
    const after = await snapshot();

    expect(after).toEqual(before);
  }, 60000);

  itIfDb("SEED-IDEMP-02: a legitimate application change to a seeded account survives a rerun", async () => {
    const prisma = getPrisma();
    const email = "ada@example.com";

    const original = await prisma.user.findUnique({ where: { email } });
    expect(original).not.toBeNull();

    // Simulate a legitimate administrator change: role, activation, password, and the
    // must-change flag are all application-managed state. A real bcrypt hash is used so
    // the value satisfies the VARCHAR(60) column contract.
    const customHash = await bcrypt.hash("AdminChangedPassword123!", 10);
    try {
      await prisma.user.update({
        where: { email },
        data: {
          role: "IT_STAFF",
          isActive: false,
          passwordHash: customHash,
          mustChangePassword: false,
        },
      });

      runSeed();

      const after = await prisma.user.findUnique({ where: { email } });
      expect(after!.role).toBe("IT_STAFF");
      expect(after!.isActive).toBe(false);
      expect(after!.passwordHash).toBe(customHash);
      expect(after!.mustChangePassword).toBe(false);
    } finally {
      // Restore the seeded account so other suites observe the documented seed state.
      await prisma.user.update({
        where: { email },
        data: {
          role: original!.role,
          isActive: original!.isActive,
          passwordHash: original!.passwordHash,
          mustChangePassword: original!.mustChangePassword,
        },
      });
    }
  }, 60000);

  itIfDb("SEED-COLLISION-01: a non-seed ticket resembling a seed ticket is never claimed or mutated", async () => {
    const prisma = getPrisma();

    // A real user creates a Ticket with the SAME summary and requester as a seed ticket,
    // but WITHOUT the seed marker. The seed must not treat it as its own.
    const ada = await prisma.user.findUnique({ where: { email: "ada@example.com" } });
    const category = await prisma.category.findFirst({ where: { name: "Hardware" } });
    const system = await prisma.relatedSystem.findFirst({ where: { name: "Corporate Laptop" } });
    expect(ada && category && system).toBeTruthy();

    const { allocateTicketNumber } = await import("../../src/ticket-number.js");
    const ticketNumber = await allocateTicketNumber(new Date().getUTCFullYear());

    const decoy = await prisma.ticket.create({
      data: {
        ticketNumber,
        requesterId: ada!.id,
        categoryId: category!.id,
        relatedSystemId: system!.id,
        summary: `${TEST_MARKER} Cannot access corporate email`,
        description: `${TEST_MARKER} A real user-created ticket that resembles a seed ticket.`,
        requestedPriority: "HIGH",
        itPriority: "HIGH",
        currentStatus: "OPEN",
      },
    });

    try {
      const before = await prisma.ticket.findUnique({ where: { id: decoy.id } });
      const commentsBefore = await prisma.comment.count({ where: { ticketId: decoy.id } });
      const notesBefore = await prisma.internalNote.count({ where: { ticketId: decoy.id } });

      runSeed();

      const after = await prisma.ticket.findUnique({ where: { id: decoy.id } });
      expect(after).toEqual(before);
      expect(await prisma.comment.count({ where: { ticketId: decoy.id } })).toBe(commentsBefore);
      expect(await prisma.internalNote.count({ where: { ticketId: decoy.id } })).toBe(notesBefore);
    } finally {
      await prisma.comment.deleteMany({ where: { ticketId: decoy.id } });
      await prisma.internalNote.deleteMany({ where: { ticketId: decoy.id } });
      await prisma.ticket.delete({ where: { id: decoy.id } });
    }
  }, 60000);

  itIfDb("SEED-COMMENT-01: a second seed run does not duplicate seed comments", async () => {
    const prisma = getPrisma();
    const before = await prisma.comment.count();
    runSeed();
    expect(await prisma.comment.count()).toBe(before);
  }, 60000);

  itIfDb("SEED-NOTE-01: a second seed run does not duplicate seed internal notes", async () => {
    const prisma = getPrisma();
    const before = await prisma.internalNote.count();
    runSeed();
    expect(await prisma.internalNote.count()).toBe(before);
  }, 60000);
});