/**
 * Shared Action API test fixtures (Issue #51).
 *
 * Creates uniquely-named test users, a Ticket, and Actions directly through
 * Prisma so the API tests can assert reads/writes without depending on seed
 * data. Every fixture is removed in `cleanupActionFixtures`.
 *
 * Not a test file — it lives outside the `*.test.ts` include pattern.
 */

import { getPrisma } from "../../../src/prisma.js";
import { allocateTicketNumber } from "../../../src/ticket-number.js";
import { ensureTestUser, loginAs, type TestSession } from "../../lab-03/helpers/auth.js";

/** A unique suffix so parallel/rerun fixtures never collide. */
export function uniqueSuffix(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

export interface ActionFixture {
  suffix: string;
  requester: { id: number; email: string; session: TestSession };
  otherRequester: { id: number; email: string; session: TestSession };
  staff: { id: number; email: string; session: TestSession };
  otherStaff: { id: number; email: string; session: TestSession };
  inactiveStaff: { id: number; email: string };
  admin: { id: number; email: string; session: TestSession };
  ticketNumber: string;
  ticketId: number;
  cleanup: () => Promise<void>;
}

/**
 * Builds a complete Action fixture: a Requester-owned Ticket plus the staff,
 * admin, and inactive-staff identities the authorization matrix needs.
 */
export async function createActionFixture(): Promise<ActionFixture> {
  const prisma = getPrisma();
  const suffix = uniqueSuffix();

  const requesterEmail = `act-req-${suffix}@example.com`;
  const otherRequesterEmail = `act-req2-${suffix}@example.com`;
  const staffEmail = `act-staff-${suffix}@example.com`;
  const otherStaffEmail = `act-staff2-${suffix}@example.com`;
  const inactiveStaffEmail = `act-inactive-${suffix}@example.com`;
  const adminEmail = `act-admin-${suffix}@example.com`;

  const requesterId = await ensureTestUser({ email: requesterEmail, name: "Action Requester", role: "REQUESTER" });
  const otherRequesterId = await ensureTestUser({ email: otherRequesterEmail, name: "Other Requester", role: "REQUESTER" });
  const staffId = await ensureTestUser({ email: staffEmail, name: "Action Staff", role: "IT_STAFF" });
  const otherStaffId = await ensureTestUser({ email: otherStaffEmail, name: "Other Staff", role: "IT_STAFF" });
  const inactiveStaffId = await ensureTestUser({
    email: inactiveStaffEmail,
    name: "Inactive Staff",
    role: "IT_STAFF",
    isActive: false,
  });
  const adminId = await ensureTestUser({ email: adminEmail, name: "Action Admin", role: "ADMINISTRATOR" });

  const category = await prisma.category.findFirst({ where: { isActive: true }, orderBy: { id: "asc" } });
  const system = await prisma.relatedSystem.findFirst({ where: { isActive: true }, orderBy: { id: "asc" } });
  if (!category || !system) {
    throw new Error("Action fixture requires at least one active Category and RelatedSystem.");
  }

  const ticketNumber = await allocateTicketNumber(new Date().getUTCFullYear());
  const ticket = await prisma.ticket.create({
    data: {
      ticketNumber,
      requesterId,
      categoryId: category.id,
      relatedSystemId: system.id,
      summary: `Action fixture ${suffix}`,
      description: `Action fixture ticket ${suffix}`,
      requestedPriority: "MEDIUM",
      itPriority: "MEDIUM",
      ticketOwnerId: staffId,
      currentStatus: "IN_PROGRESS",
    },
  });

  const requesterSession = await loginAs(requesterEmail);
  const otherRequesterSession = await loginAs(otherRequesterEmail);
  const staffSession = await loginAs(staffEmail);
  const otherStaffSession = await loginAs(otherStaffEmail);
  const adminSession = await loginAs(adminEmail);

  return {
    suffix,
    requester: { id: requesterId, email: requesterEmail, session: requesterSession },
    otherRequester: { id: otherRequesterId, email: otherRequesterEmail, session: otherRequesterSession },
    staff: { id: staffId, email: staffEmail, session: staffSession },
    otherStaff: { id: otherStaffId, email: otherStaffEmail, session: otherStaffSession },
    inactiveStaff: { id: inactiveStaffId, email: inactiveStaffEmail },
    admin: { id: adminId, email: adminEmail, session: adminSession },
    ticketNumber,
    ticketId: ticket.id,
    cleanup: async () => {
      // Remove Actions/revisions/idempotency for this Ticket, then the Ticket and users.
      const actions = await prisma.actionTaken.findMany({ where: { ticketId: ticket.id }, select: { id: true } });
      const actionIds = actions.map((a) => a.id);
      if (actionIds.length > 0) {
        await prisma.actionTakenRevision.deleteMany({ where: { actionId: { in: actionIds } } });
        await prisma.actionCreateIdempotency.deleteMany({ where: { actionId: { in: actionIds } } });
        await prisma.actionTaken.deleteMany({ where: { id: { in: actionIds } } });
      }
      await prisma.ticket.deleteMany({ where: { id: ticket.id } });
      await prisma.user.deleteMany({
        where: {
          email: {
            in: [requesterEmail, otherRequesterEmail, staffEmail, otherStaffEmail, inactiveStaffEmail, adminEmail],
          },
        },
      });
    },
  };
}

/** Creates an Action directly through Prisma (for read/authorization tests). */
export async function seedAction(options: {
  ticketId: number;
  performedByUserId: number;
  description: string;
  status?: "PENDING" | "COMPLETED" | "CANCELLED";
  assigneeUserId?: number | null;
  result?: string | null;
  followUpRequired?: boolean;
  followUpNote?: string | null;
  attachmentNotes?: string | null;
  version?: number;
}): Promise<number> {
  const prisma = getPrisma();
  const action = await prisma.actionTaken.create({
    data: {
      ticketId: options.ticketId,
      description: options.description,
      result: options.result ?? null,
      followUpRequired: options.followUpRequired ?? false,
      followUpNote: options.followUpNote ?? null,
      attachmentNotes: options.attachmentNotes ?? null,
      status: options.status ?? "PENDING",
      performedByUserId: options.performedByUserId,
      assigneeUserId: options.assigneeUserId ?? null,
      version: options.version ?? 1,
    },
  });
  return action.id;
}
