-- Lab 4 — Actions Taken foundation (additive-only)
-- Issue #51: Actions Taken persistence/API foundation.
-- Adds ActionStatus, ActionTaken, ActionTakenRevision, TicketStatusChange,
-- ActionCreateIdempotency, and Ticket.version / Ticket.resolvedAt.
--
-- Additive guarantees (specification.md §7, BR-22/BR-32):
--   * No existing column is modified or dropped; no existing row is rewritten.
--   * Every existing Ticket receives version = 1 via the column default.
--   * Existing Resolved Tickets keep resolvedAt = NULL (never inferred from updatedAt).
--   * No synthetic Action or TicketStatusChange rows are created.
--   * No new index is added to "Ticket".
--   * The runtime "session" table (connect-pg-simple) is NOT part of the Prisma
--     schema and is deliberately left untouched.

-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');

-- AlterTable (additive columns only)
ALTER TABLE "Ticket" ADD COLUMN     "resolvedAt" TIMESTAMPTZ(3),
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "ActionTaken" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "result" TEXT,
    "followUpRequired" BOOLEAN NOT NULL DEFAULT false,
    "followUpNote" TEXT,
    "attachmentNotes" TEXT,
    "status" "ActionStatus" NOT NULL DEFAULT 'PENDING',
    "performedByUserId" INTEGER NOT NULL,
    "assigneeUserId" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ActionTaken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionTakenRevision" (
    "id" SERIAL NOT NULL,
    "actionId" INTEGER NOT NULL,
    "editedByUserId" INTEGER NOT NULL,
    "editedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "versionBefore" INTEGER NOT NULL,
    "versionAfter" INTEGER NOT NULL,
    "beforeSnapshot" JSONB NOT NULL,
    "afterSnapshot" JSONB NOT NULL,

    CONSTRAINT "ActionTakenRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketStatusChange" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "changedByUserId" INTEGER NOT NULL,
    "changedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fromStatus" "TicketStatus" NOT NULL,
    "toStatus" "TicketStatus" NOT NULL,
    "versionBefore" INTEGER NOT NULL,
    "versionAfter" INTEGER NOT NULL,

    CONSTRAINT "TicketStatusChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionCreateIdempotency" (
    "id" SERIAL NOT NULL,
    "actorUserId" INTEGER NOT NULL,
    "route" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "actionId" INTEGER NOT NULL,
    "responseBody" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ActionCreateIdempotency_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActionTaken_ticketId_createdAt_id_idx" ON "ActionTaken"("ticketId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "ActionTaken_assigneeUserId_status_createdAt_id_idx" ON "ActionTaken"("assigneeUserId", "status", "createdAt", "id");

-- CreateIndex
CREATE INDEX "ActionTaken_performedByUserId_createdAt_id_idx" ON "ActionTaken"("performedByUserId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "ActionTakenRevision_actionId_editedAt_id_idx" ON "ActionTakenRevision"("actionId", "editedAt", "id");

-- CreateIndex
CREATE INDEX "TicketStatusChange_ticketId_changedAt_id_idx" ON "TicketStatusChange"("ticketId", "changedAt", "id");

-- CreateIndex
CREATE INDEX "ActionCreateIdempotency_expiresAt_id_idx" ON "ActionCreateIdempotency"("expiresAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ActionCreateIdempotency_actorUserId_route_key_key" ON "ActionCreateIdempotency"("actorUserId", "route", "key");

-- AddForeignKey
ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_performedByUserId_fkey" FOREIGN KEY ("performedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_assigneeUserId_fkey" FOREIGN KEY ("assigneeUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionTakenRevision" ADD CONSTRAINT "ActionTakenRevision_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "ActionTaken"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionTakenRevision" ADD CONSTRAINT "ActionTakenRevision_editedByUserId_fkey" FOREIGN KEY ("editedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketStatusChange" ADD CONSTRAINT "TicketStatusChange_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketStatusChange" ADD CONSTRAINT "TicketStatusChange_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionCreateIdempotency" ADD CONSTRAINT "ActionCreateIdempotency_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionCreateIdempotency" ADD CONSTRAINT "ActionCreateIdempotency_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "ActionTaken"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
