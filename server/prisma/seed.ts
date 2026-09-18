import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { deriveInitialPassword } from '../src/migrate-lab3.js';
import { allocateTicketNumberWithClient } from '../src/ticket-number.js';

const prisma = new PrismaClient();

// Locally-documented development credentials (no real secrets).
// Derived deterministically per the frozen formula (§13 decision 13):
//   "Lab3-" + first 20 hex chars of SHA-256(lowercase(trim(email)) + ":" + trim(name))
// These are development-only; documented in the repository README.

const REQUESTERS = [
  { name: 'Ada Lovelace', email: 'ada@example.com', isActive: true },
  { name: 'Grace Hopper', email: 'grace@example.com', isActive: true },
  { name: 'Katherine Johnson', email: 'katherine@example.com', isActive: true },
  { name: 'Alan Turing', email: 'alan@example.com', isActive: true },
  { name: 'Edsger Dijkstra', email: 'edsger@example.com', isActive: false },
];

const IT_STAFF = [
  { name: 'Linus Torvalds', email: 'linus@example.com', isActive: true },
  { name: 'Margaret Hamilton', email: 'margaret@example.com', isActive: true },
  { name: 'Grace Brewster', email: 'graceb@example.com', isActive: true },
  { name: 'Ken Thompson', email: 'ken@example.com', isActive: false },
];

const ADMINISTRATORS = [
  { name: 'Dennis Ritchie', email: 'dennis@example.com', isActive: true },
];

const CATEGORIES = ['Account and Access', 'Hardware', 'Software', 'Network'];

const RELATED_SYSTEMS = [
  { name: 'Corporate Laptop' },
  { name: 'Campus Wi-Fi' },
  { name: 'Email System' },
  { name: 'VPN Gateway' },
  { name: 'HR Portal' },
  { name: 'Shared Drive' },
];

/**
 * Seed-owned identity marker (PR #46 review follow-up, B-5).
 *
 * Seed Tickets are identified by a deterministic, documented marker embedded in the
 * `description` field — NOT by `summary + requesterId`. A real user could create a Ticket
 * with the same summary and requester; matching on those alone would let the seed claim
 * (and then mutate) an unrelated Ticket. The marker is a stable seed-owned key that cannot
 * reasonably collide with ordinary Ticket creation.
 */
const SEED_MARKER_PREFIX = '[seed:';
const seedMarker = (key: string): string => `${SEED_MARKER_PREFIX}${key}]`;

/**
 * Creates a predefined account if it does not already exist.
 *
 * NON-DESTRUCTIVE (B-5): an existing account is left exactly as the application left it.
 * The seed does not overwrite `name`, `email`, `role`, `isActive`, `passwordHash`, or
 * `mustChangePassword` on rerun, so a legitimate administrator change survives re-seeding.
 * A destructive reset, if ever needed, must be a separate development-only command.
 */
async function ensureUser(
  user: { name: string; email: string; isActive: boolean },
  role: 'REQUESTER' | 'IT_STAFF' | 'ADMINISTRATOR',
) {
  const existing = await prisma.user.findUnique({ where: { email: user.email } });
  if (existing) {
    return existing;
  }
  const passwordHash = await bcrypt.hash(deriveInitialPassword(user.email, user.name), 10);
  return prisma.user.create({
    data: {
      name: user.name,
      email: user.email,
      role,
      passwordHash,
      isActive: user.isActive,
      mustChangePassword: true,
    },
  });
}

async function main() {
  // Categories (preserved; idempotent upserts)
  for (const name of CATEGORIES) {
    await prisma.category.upsert({ where: { name }, update: {}, create: { name } });
  }

  // Related Systems (preserved; idempotent upserts)
  for (const system of RELATED_SYSTEMS) {
    await prisma.relatedSystem.upsert({ where: { name: system.name }, update: {}, create: system });
  }

  // Users: Requesters (4 active + 1 inactive), IT Staff (3 active + 1 inactive), Administrator (>=1 active)
  const requesterUsers = [];
  for (const r of REQUESTERS) {
    requesterUsers.push(await ensureUser(r, 'REQUESTER'));
  }
  const staffUsers = [];
  for (const s of IT_STAFF) {
    staffUsers.push(await ensureUser(s, 'IT_STAFF'));
  }
  const adminUsers = [];
  for (const a of ADMINISTRATORS) {
    adminUsers.push(await ensureUser(a, 'ADMINISTRATOR'));
  }

  // Realistic Tickets across statuses/priorities/ownership (idempotent by ticketNumber).
  // Scope the reference data to the seed's OWN categories/systems: seed tickets must never
  // attach to pre-existing unrelated records (e.g. a Category planted by another test),
  // which would create an FK reference that blocks that record's cleanup and break the
  // Lab 2 regression suite. (Lab 2 regression: `tests/lab-02/seed.integration.test.ts`.)
  const categories = await prisma.category.findMany({
    where: { name: { in: CATEGORIES } },
    orderBy: { id: 'asc' },
  });
  const systems = await prisma.relatedSystem.findMany({
    where: { name: { in: RELATED_SYSTEMS.map((s) => s.name) } },
    orderBy: { id: 'asc' },
  });

  const tickets = [
    { key: 'email-access', summary: 'Cannot access corporate email', description: 'Email client returns an authentication error since this morning.', status: 'OPEN', priority: 'HIGH', owner: staffUsers[0] },
    { key: 'laptop-screen', summary: 'Laptop screen flickers intermittently', description: 'The display flickers when the laptop is on battery power.', status: 'IN_PROGRESS', priority: 'MEDIUM', owner: staffUsers[1] },
    { key: 'vpn-drops', summary: 'VPN connection drops frequently', description: 'The VPN disconnects every few minutes during remote work.', status: 'WAITING_FOR_REQUESTER', priority: 'HIGH', owner: staffUsers[2] },
    { key: 'shared-drive', summary: 'Shared drive permission denied', description: 'Cannot write to the shared drive folder for the project.', status: 'NEW', priority: 'LOW', owner: null },
    { key: 'printer-network', summary: 'Printer not detected on network', description: 'The network printer is not visible from the workstation.', status: 'RESOLVED', priority: 'MEDIUM', owner: staffUsers[0] },
    { key: 'hr-portal-loop', summary: 'HR portal login loop', description: 'The HR portal redirects back to login after authenticating.', status: 'CLOSED', priority: 'HIGH', owner: staffUsers[1] },
  ];

  const createdTickets = [];
  for (let i = 0; i < tickets.length; i++) {
    const t = tickets[i];
    const requester = requesterUsers[i % requesterUsers.length];
    const category = categories[i % categories.length];
    const system = systems[i % systems.length];
    const marker = seedMarker(t.key);

    // Idempotency: reuse the existing seed-owned Ticket (matched by its deterministic
    // seed marker) instead of creating a new one on every run. Never match on
    // summary + requester alone — that could claim an unrelated user-created Ticket.
    let ticket = await prisma.ticket.findFirst({
      where: { description: { contains: marker } },
    });
    if (!ticket) {
      // Allocate the canonical six-digit ticket number and create the Ticket in one
      // transaction, using the SAME allocator as application code (B-4).
      ticket = await prisma.$transaction(async (tx) => {
        const ticketNumber = await allocateTicketNumberWithClient(tx, new Date().getUTCFullYear());
        return tx.ticket.create({
          data: {
            ticketNumber,
            requesterId: requester.id,
            categoryId: category.id,
            relatedSystemId: system.id,
            summary: t.summary,
            description: `${marker} ${t.description}`,
            requestedPriority: t.priority as 'LOW' | 'MEDIUM' | 'HIGH',
            itPriority: t.priority as 'LOW' | 'MEDIUM' | 'HIGH',
            ticketOwnerId: t.owner ? t.owner.id : null,
            currentStatus: t.status as 'NEW' | 'OPEN' | 'IN_PROGRESS' | 'WAITING_FOR_REQUESTER' | 'RESOLVED' | 'CLOSED' | 'REOPENED' | 'CANCELLED',
            appearsResolved: t.status === 'RESOLVED' || t.status === 'CLOSED',
          },
        });
      });
    }
    createdTickets.push(ticket);
  }

  // Example Comments and Internal Notes (append-only; no sensitive content).
  // Idempotency: create only when the exact seed-owned artifact is absent on a
  // seed-owned Ticket. Never key off "the ticket has zero comments" — that does not
  // prove the Ticket is seed-owned and could attach seed content to a real Ticket.
  for (let i = 0; i < createdTickets.length; i++) {
    const ticket = createdTickets[i];
    const author = requesterUsers[i % requesterUsers.length];
    const staff = staffUsers[i % staffUsers.length];

    const commentContent = 'Please provide an update on this ticket.';
    const existingComment = await prisma.comment.findFirst({
      where: { ticketId: ticket.id, content: commentContent },
    });
    if (!existingComment) {
      await prisma.comment.create({
        data: { ticketId: ticket.id, authorId: author.id, content: commentContent },
      });
    }

    const noteContent = 'Investigating the reported issue.';
    const existingNote = await prisma.internalNote.findFirst({
      where: { ticketId: ticket.id, content: noteContent },
    });
    if (!existingNote) {
      await prisma.internalNote.create({
        data: { ticketId: ticket.id, authorId: staff.id, content: noteContent },
      });
    }
  }

  console.log('Seed completed. Users, categories, related systems, tickets, comments, and internal notes inserted/verified.');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

