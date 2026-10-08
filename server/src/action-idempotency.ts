/**
 * Actions Taken — idempotency expiry cleanup (Issue #51).
 *
 * Frozen authority: `docs/lab-04/api-spec.md` §12 and
 * `docs/lab-04/specification.md` §7.
 *
 * An hourly invocation deletes at most 500 expired rows, ordered by
 * `(expiresAt, id)`, using one transaction per batch. It emits the deleted-row
 * count and a success/failure result; the next hourly invocation continues any
 * remaining expired rows. Expiry is enforced during key lookup regardless of
 * whether cleanup has run.
 */

import { getPrisma } from "./prisma.js";

/** Maximum rows deleted per cleanup transaction (frozen). */
export const CLEANUP_BATCH_SIZE = 500;

/** Hourly cleanup interval in milliseconds. */
export const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

export interface CleanupResult {
  deleted: number;
  ok: boolean;
}

/**
 * Deletes one bounded batch of expired idempotency rows.
 *
 * Only rows with `expiresAt <= now` (evaluated once, in UTC, for this
 * invocation) are deleted. The batch is ordered by `(expiresAt, id)` and capped
 * at `CLEANUP_BATCH_SIZE`. Returns the deleted-row count and a success flag.
 */
export async function cleanupExpiredIdempotency(now: Date = new Date()): Promise<CleanupResult> {
  const prisma = getPrisma();
  try {
    const deleted = await prisma.$transaction(async (tx) => {
      const rows = await tx.actionCreateIdempotency.findMany({
        where: { expiresAt: { lte: now } },
        orderBy: [{ expiresAt: "asc" }, { id: "asc" }],
        take: CLEANUP_BATCH_SIZE,
        select: { id: true },
      });
      if (rows.length === 0) return 0;
      const result = await tx.actionCreateIdempotency.deleteMany({
        where: { id: { in: rows.map((r) => r.id) } },
      });
      return result.count;
    });
    return { deleted, ok: true };
  } catch {
    return { deleted: 0, ok: false };
  }
}

/**
 * Starts the hourly idempotency cleanup timer.
 *
 * The timer is `unref()`-ed so it never keeps a test process (or a short-lived
 * CLI) alive. Returns a stop function.
 */
export function startIdempotencyCleanupScheduler(): () => void {
  const timer = setInterval(() => {
    void cleanupExpiredIdempotency().then((result) => {
      console.log(
        `[action-idempotency] cleanup ${result.ok ? "ok" : "failed"}: deleted ${result.deleted} expired row(s).`,
      );
    });
  }, CLEANUP_INTERVAL_MS);
  // Do not hold the event loop open.
  timer.unref?.();
  return () => clearInterval(timer);
}
