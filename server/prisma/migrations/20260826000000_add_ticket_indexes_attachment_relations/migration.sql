-- Add required Ticket indexes (Specification §7)
CREATE INDEX "Ticket_requesterId_idx" ON "Ticket"("requesterId");
CREATE INDEX "Ticket_currentStatus_idx" ON "Ticket"("currentStatus");
CREATE INDEX "Ticket_createdAt_idx" ON "Ticket"("createdAt");

-- Add unique constraint on Attachment.storedFilename
CREATE UNIQUE INDEX "Attachment_storedFilename_key" ON "Attachment"("storedFilename");

-- Add index on Attachment.ticketId
CREATE INDEX "Attachment_ticketId_idx" ON "Attachment"("ticketId");

-- Add foreign key constraints for Attachment uploader and remover
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_uploaderRequesterId_fkey"
  FOREIGN KEY ("uploaderRequesterId") REFERENCES "DevRequester"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_removedByRequesterId_fkey"
  FOREIGN KEY ("removedByRequesterId") REFERENCES "DevRequester"("id") ON DELETE SET NULL ON UPDATE CASCADE;