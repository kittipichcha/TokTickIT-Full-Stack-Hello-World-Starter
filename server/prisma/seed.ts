import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { deriveInitialPassword } from '../src/migrate-lab3.js';

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

async function upsertUser(user: { name: string; email: string; isActive: boolean }, role: 'REQUESTER' | 'IT_STAFF' | 'ADMINISTRATOR') {
  const passwordHash = await bcrypt.hash(deriveInitialPassword(user.email, user.name), 10);
  return prisma.user.upsert({
    where: { email: user.email },
    update: { name: user.name, isActive: user.isActive, role },
    create: {
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
    requesterUsers.push(await upsertUser(r, 'REQUESTER'));
  }
  const staffUsers = [];
  for (const s of IT_STAFF) {
    staffUsers.push(await upsertUser(s, 'IT_STAFF'));
  }
  const adminUsers = [];
  for (const a of ADMINISTRATORS) {
    adminUsers.push(await upsertUser(a, 'ADMINISTRATOR'));
  }

  // Realistic Tickets across statuses/priorities/ownership (idempotent by ticketNumber)
  const categories = await prisma.category.findMany({ orderBy: { id: 'asc' } });
  const systems = await prisma.relatedSystem.findMany({ orderBy: { id: 'asc' } });

  const tickets = [
    { summary: 'Cannot access corporate email', description: 'Email client returns an authentication error since this morning.', status: 'OPEN', priority: 'HIGH', owner: staffUsers[0] },
    { summary: 'Laptop screen flickers intermittently', description: 'The display flickers when the laptop is on battery power.', status: 'IN_PROGRESS', priority: 'MEDIUM', owner: staffUsers[1] },
    { summary: 'VPN connection drops frequently', description: 'The VPN disconnects every few minutes during remote work.', status: 'WAITING_FOR_REQUESTER', priority: 'HIGH', owner: staffUsers[2] },
    { summary: 'Shared drive permission denied', description: 'Cannot write to the shared drive folder for the project.', status: 'NEW', priority: 'LOW', owner: null },
    { summary: 'Printer not detected on network', description: 'The network printer is not visible from the workstation.', status: 'RESOLVED', priority: 'MEDIUM', owner: staffUsers[0] },
    { summary: 'HR portal login loop', description: 'The HR portal redirects back to login after authenticating.', status: 'CLOSED', priority: 'HIGH', owner: staffUsers[1] },
  ];

  const createdTickets = [];
  for (let i = 0; i < tickets.length; i++) {
    const t = tickets[i];
    const requester = requesterUsers[i % requesterUsers.length];
    const category = categories[i % categories.length];
    const system = systems[i % systems.length];
    const year = new Date().getUTCFullYear();
    const seq = await prisma.ticketSequence.upsert({
      where: { year },
      update: { lastSeq: { increment: 1 } },
      create: { year, lastSeq: 1 },
    });
    const ticketNumber = `TKT-${year}-${String(seq.lastSeq).padStart(4, '0')}`;
    const ticket = await prisma.ticket.upsert({
      where: { ticketNumber },
      update: {},
      create: {
        ticketNumber,
        requesterId: requester.id,
        categoryId: category.id,
        relatedSystemId: system.id,
        summary: t.summary,
        description: t.description,
        requestedPriority: t.priority as 'LOW' | 'MEDIUM' | 'HIGH',
        itPriority: t.priority as 'LOW' | 'MEDIUM' | 'HIGH',
        ticketOwnerId: t.owner ? t.owner.id : null,
        currentStatus: t.status as 'NEW' | 'OPEN' | 'IN_PROGRESS' | 'WAITING_FOR_REQUESTER' | 'RESOLVED' | 'CLOSED' | 'REOPENED' | 'CANCELLED',
        appearsResolved: t.status === 'RESOLVED' || t.status === 'CLOSED',
      },
    });
    createdTickets.push(ticket);
  }

  // Example Comments and Internal Notes (append-only; no sensitive content).
  // Idempotency: only create when the ticket has none yet.
  for (let i = 0; i < createdTickets.length; i++) {
    const ticket = createdTickets[i];
    const author = requesterUsers[i % requesterUsers.length];
    const staff = staffUsers[i % staffUsers.length];
    const existingComments = await prisma.comment.count({ where: { ticketId: ticket.id } });
    if (existingComments === 0) {
      await prisma.comment.create({
        data: { ticketId: ticket.id, authorId: author.id, content: 'Please provide an update on this ticket.' },
      });
    }
    const existingNotes = await prisma.internalNote.count({ where: { ticketId: ticket.id } });
    if (existingNotes === 0) {
      await prisma.internalNote.create({
        data: { ticketId: ticket.id, authorId: staff.id, content: 'Investigating the reported issue.' },
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

