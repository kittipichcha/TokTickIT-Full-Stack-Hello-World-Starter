import { PrismaClient, Prisma } from "@prisma/client";

const MAX_SEQUENCE = 999999;

export class TicketSequenceExhaustedError extends Error {
  constructor(year: number) {
    super(`Ticket sequence exhausted for year ${year}`);
    this.name = "TicketSequenceExhaustedError";
  }
}

/**
 * Atomically allocates the next ticket number for the given UTC year.
 *
 * Uses a single `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` statement so the
 * increment is serialized by the row lock PostgreSQL takes during the upsert.
 * This guarantees that concurrent creates receive distinct numbers without a
 * read-then-write race.
 *
 * Returns the generated ticket number string like "TKT-2026-000123".
 * Throws TicketSequenceExhaustedError if all 999,999 values are allocated.
 */
export async function allocateTicketNumber(utcYear: number): Promise<string> {
  const { getPrisma } = await import("./prisma.js");
  const prisma = getPrisma();
  return allocateTicketNumberWithClient(prisma, utcYear);
}

/**
 * Same as allocateTicketNumber but accepts an explicit Prisma client (or transaction
 * client) so the allocation can participate in a wider database transaction.
 */
export async function allocateTicketNumberWithClient(
  client: PrismaClient | Prisma.TransactionClient,
  utcYear: number,
): Promise<string> {
  const rows = await client.$queryRaw<Array<{ lastSeq: number }>>`
    INSERT INTO "TicketSequence" ("year", "lastSeq")
    VALUES (${utcYear}, 1)
    ON CONFLICT ("year") DO UPDATE
      SET "lastSeq" = "TicketSequence"."lastSeq" + 1
    RETURNING "lastSeq"
  `;

  const lastSeq = rows[0]?.lastSeq;

  if (lastSeq === undefined || lastSeq > MAX_SEQUENCE) {
    throw new TicketSequenceExhaustedError(utcYear);
  }

  const paddedSeq = String(lastSeq).padStart(6, "0");
  return `TKT-${utcYear}-${paddedSeq}`;
}
