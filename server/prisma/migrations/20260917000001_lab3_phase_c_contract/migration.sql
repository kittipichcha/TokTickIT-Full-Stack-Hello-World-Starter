-- Lab 3 Phase C — contract
-- Issue #35: Identity, Database Migration & Authentication
-- Finalizes FKs/constraints, converts timestamps to timestamptz (DM-TIME-01),
-- drops the legacy DevRequester table and legacy Attachment requester columns.
-- Runs AFTER the backfill (orchestrator) has populated User and the shadow columns.

-- Ticket.appearsResolved: backfill false, then NOT NULL @default(false)
UPDATE "Ticket" SET "appearsResolved" = false WHERE "appearsResolved" IS NULL;
ALTER TABLE "Ticket" ALTER COLUMN "appearsResolved" SET NOT NULL;
ALTER TABLE "Ticket" ALTER COLUMN "appearsResolved" SET DEFAULT false;

-- Attachment.uploaderUserId: NOT NULL (backfilled by orchestrator); removedByUserId stays nullable
ALTER TABLE "Attachment" ALTER COLUMN "uploaderUserId" SET NOT NULL;

-- uploaderUserId is now required (NOT NULL), so its FK must be ON DELETE RESTRICT (no cascade).
ALTER TABLE "Attachment" DROP CONSTRAINT "Attachment_uploaderUserId_fkey";
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_uploaderUserId_fkey" FOREIGN KEY ("uploaderUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- DM-TIME-01: convert existing §9.3 timestamp columns from TIMESTAMP(3) to timestamptz(3),
-- interpreting stored naive values as UTC instants (frozen UTC-preservation strategy).
ALTER TABLE "Category" ALTER COLUMN "createdAt" TYPE timestamptz(3) USING "createdAt" AT TIME ZONE 'UTC';
ALTER TABLE "RelatedSystem" ALTER COLUMN "createdAt" TYPE timestamptz(3) USING "createdAt" AT TIME ZONE 'UTC';
ALTER TABLE "Ticket" ALTER COLUMN "createdAt" TYPE timestamptz(3) USING "createdAt" AT TIME ZONE 'UTC';
ALTER TABLE "Ticket" ALTER COLUMN "updatedAt" TYPE timestamptz(3) USING "updatedAt" AT TIME ZONE 'UTC';
ALTER TABLE "Attachment" ALTER COLUMN "uploadedAt" TYPE timestamptz(3) USING "uploadedAt" AT TIME ZONE 'UTC';
ALTER TABLE "Attachment" ALTER COLUMN "removedAt" TYPE timestamptz(3) USING "removedAt" AT TIME ZONE 'UTC';

-- Drop the legacy Attachment requester columns (ownership now via User FKs)
ALTER TABLE "Attachment" DROP COLUMN "uploaderRequesterId";
ALTER TABLE "Attachment" DROP COLUMN "removedByRequesterId";

-- Re-point Ticket.requesterId FK from DevRequester to User (exact ID preservation makes this safe)
ALTER TABLE "Ticket" DROP CONSTRAINT "Ticket_requesterId_fkey";
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Drop the legacy DevRequester table (Option B: migrate, prove, remove)
DROP TABLE "DevRequester";

-- Add the frozen Ticket index on ticketOwnerId (index list completion)
CREATE INDEX "Ticket_ticketOwnerId_idx" ON "Ticket"("ticketOwnerId");