import { describe, it, expect, afterAll } from "vitest";
import { getPrisma, disconnectPrisma } from "../../src/prisma.js";

const itIfDb = process.env.DATABASE_URL ? it : it.skip;

const REQUIRED_CATEGORIES = ["Account and Access", "Hardware", "Software", "Network"];

describe("DB-01 / DB-02: Lab 2 forward migration against the real database", () => {
  afterAll(async () => {
    if (process.env.DATABASE_URL) await disconnectPrisma();
  });

  itIfDb("DB-01: creates all required tables without resetting the database", async () => {
    const prisma = getPrisma();
    const rows = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
    `;
    const names = new Set(rows.map((r) => r.table_name));

    for (const table of [
      "Category",
      "DevRequester",
      "RelatedSystem",
      "Ticket",
      "Attachment",
      "TicketSequence",
    ]) {
      expect(names.has(table)).toBe(true);
    }
  });

  itIfDb("DB-01: Ticket table exposes all required columns", async () => {
    const prisma = getPrisma();
    const rows = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'Ticket'
    `;
    const columns = new Set(rows.map((r) => r.column_name));

    for (const column of [
      "id",
      "ticketNumber",
      "requesterId",
      "categoryId",
      "relatedSystemId",
      "summary",
      "description",
      "requestedPriority",
      "itPriority",
      "ticketOwnerId",
      "currentStatus",
      "createdAt",
      "updatedAt",
    ]) {
      expect(columns.has(column)).toBe(true);
    }
  });

  itIfDb("DB-01: itPriority and ticketOwnerId are nullable (Lab 2 never writes them)", async () => {
    const prisma = getPrisma();
    const rows = await prisma.$queryRaw<Array<{ column_name: string; is_nullable: string }>>`
      SELECT column_name, is_nullable FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'Ticket'
        AND column_name IN ('itPriority', 'ticketOwnerId')
    `;

    expect(rows.length).toBe(2);
    for (const row of rows) {
      expect(row.is_nullable).toBe("YES");
    }
  });

  itIfDb("DB-01: ticketNumber has a unique index", async () => {
    const prisma = getPrisma();
    // Prisma's @unique emits a UNIQUE INDEX (not a table_constraints UNIQUE row).
    const rows = await prisma.$queryRaw<Array<{ indexname: string; indexdef: string }>>`
      SELECT indexname, indexdef FROM pg_indexes
      WHERE tablename = 'Ticket'
    `;
    const ticketNumberIndex = rows.find(
      (r) => r.indexname.includes("ticketNumber") && /UNIQUE/i.test(r.indexdef),
    );
    expect(ticketNumberIndex).toBeTruthy();
  });

  itIfDb("DB-01: currentStatus defaults to NEW", async () => {
    const prisma = getPrisma();
    const rows = await prisma.$queryRaw<Array<{ column_default: string }>>`
      SELECT column_default FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'Ticket' AND column_name = 'currentStatus'
    `;
    expect(rows[0]?.column_default).toContain("NEW");
  });

  itIfDb("DB-02: existing Lab 1 Category rows survive with isActive backfilled to true", async () => {
    const prisma = getPrisma();
    for (const name of REQUIRED_CATEGORIES) {
      const category = await prisma.category.findUnique({ where: { name } });

      expect(category).not.toBeNull();
      expect(category!.id).toBeGreaterThan(0);
      expect(category!.name).toBe(name);
      expect(category!.isActive).toBe(true);
      expect(category!.createdAt).toBeInstanceOf(Date);
    }
  });
});
