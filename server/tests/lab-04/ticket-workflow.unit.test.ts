import { describe, expect, it } from "vitest";
import { TICKET_STATUSES, type TicketStatus } from "../../src/ticket-status.js";
import { isWorkflowTransitionAllowed } from "../../src/ticket-workflow-policy.js";

const expected: Readonly<Record<TicketStatus, readonly TicketStatus[]>> = {
  NEW: ["OPEN", "CANCELLED"],
  OPEN: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  WAITING_FOR_REQUESTER: ["IN_PROGRESS", "CANCELLED"],
  RESOLVED: ["CLOSED", "REOPENED", "CANCELLED"],
  CLOSED: ["REOPENED", "CANCELLED"],
  REOPENED: ["IN_PROGRESS", "CANCELLED"],
  CANCELLED: [],
};

describe("UNIT-WF-01: pure Ticket workflow policy", () => {
  it("matches the independent Lab 4 matrix for all 64 status pairs", () => {
    for (const from of TICKET_STATUSES) {
      for (const to of TICKET_STATUSES) {
        expect(isWorkflowTransitionAllowed(from, to, true, false), `${from} -> ${to}`).toBe(
          expected[from].includes(to),
        );
      }
    }
  });

  it("requires an owner and blocks only resolution while an Action is Pending", () => {
    expect(isWorkflowTransitionAllowed("NEW", "OPEN", false, false)).toBe(false);
    expect(isWorkflowTransitionAllowed("IN_PROGRESS", "RESOLVED", true, true)).toBe(false);
    expect(isWorkflowTransitionAllowed("IN_PROGRESS", "RESOLVED", true, false)).toBe(true);
    expect(isWorkflowTransitionAllowed("IN_PROGRESS", "WAITING_FOR_REQUESTER", true, true)).toBe(true);
    expect(isWorkflowTransitionAllowed("REOPENED", "IN_PROGRESS", true, true)).toBe(true);
  });
});
