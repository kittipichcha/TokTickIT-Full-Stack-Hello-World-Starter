import { isTransitionAllowed, type TicketStatus } from "./ticket-status.js";

/** Pure owner, transition-matrix, and Pending Action policy for a Ticket write. */
export function isWorkflowTransitionAllowed(
  from: TicketStatus,
  to: TicketStatus,
  hasOwner: boolean,
  hasPendingAction: boolean,
): boolean {
  return (
    hasOwner &&
    isTransitionAllowed(from, to) &&
    !(from === "IN_PROGRESS" && to === "RESOLVED" && hasPendingAction)
  );
}
