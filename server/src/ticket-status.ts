/**
 * Ticket status transition matrix (Issue #38 — the ONLY authored transition
 * source in the repository).
 *
 * Frozen authority: `docs/lab-03/specification.md` §7 (Status Transition Matrix).
 *
 * This module is pure: no imports beyond TypeScript types, no I/O, no framework
 * dependencies. The server validates transitions with it; the client renders
 * permitted transition controls from the SAME source (imported via the
 * `@shared/ticket-status` Vite alias). There is exactly one authored matrix —
 * never a second hand-authored copy, never a sync test.
 *
 * Placement (frozen, Revision 7 Option B): inside `server/src/` so the server
 * TypeScript build's inferred `rootDir` and emitted `dist/` layout are unchanged.
 */

export type TicketStatus =
  | "NEW"
  | "OPEN"
  | "IN_PROGRESS"
  | "WAITING_FOR_REQUESTER"
  | "RESOLVED"
  | "CLOSED"
  | "REOPENED"
  | "CANCELLED";

/**
 * The frozen transition table (specification.md §7), excluding the
 * "Any non-Cancelled → Cancelled" row which is applied uniformly below.
 *
 * Module-private by design: consumers use `allowedTransitionsFrom` /
 * `isTransitionAllowed` so the any-non-Cancelled rule can never be bypassed.
 */
const BASE: Readonly<Record<TicketStatus, readonly TicketStatus[]>> = {
  NEW: ["OPEN"],
  OPEN: ["IN_PROGRESS"],
  IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED"],
  WAITING_FOR_REQUESTER: ["IN_PROGRESS"],
  RESOLVED: ["CLOSED", "REOPENED"],
  CLOSED: ["REOPENED"],
  REOPENED: [],
  CANCELLED: [], // terminal
};

/**
 * Returns the statuses reachable from `from` per the frozen matrix.
 *
 * "Any non-Cancelled → Cancelled" makes CANCELLED reachable from every status
 * except itself — this makes REOPENED → CANCELLED valid while no other row
 * leaves REOPENED.
 */
export function allowedTransitionsFrom(from: TicketStatus): readonly TicketStatus[] {
  return from === "CANCELLED" ? BASE[from] : [...BASE[from], "CANCELLED"];
}

/** True when `from → to` is a permitted transition per the frozen matrix. */
export function isTransitionAllowed(from: TicketStatus, to: TicketStatus): boolean {
  if (to === "CANCELLED") return from !== "CANCELLED";
  return allowedTransitionsFrom(from).includes(to);
}

/** The frozen Ticket status set, in workflow order (specification.md §9.3). */
export const TICKET_STATUSES: readonly TicketStatus[] = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_REQUESTER",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
  "CANCELLED",
];

/** True when `value` is one of the eight frozen Ticket statuses. */
export function isTicketStatus(value: unknown): value is TicketStatus {
  return typeof value === "string" && (TICKET_STATUSES as readonly string[]).includes(value);
}
