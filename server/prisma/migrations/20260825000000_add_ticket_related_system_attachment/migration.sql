-- Create RelatedSystem table
CREATE TABLE "RelatedSystem" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RelatedSystem_pkey" PRIMARY KEY ("id")
);

-- Create unique index on RelatedSystem.name
CREATE UNIQUE INDEX "RelatedSystem_name_key" ON "RelatedSystem"("name");

-- Create Priority enum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- Create TicketStatus enum
CREATE TYPE "TicketStatus" AS ENUM ('NEW');

-- Create Ticket table
CREATE TABLE "Ticket" (
    "id" SERIAL NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "requesterId" INTEGER NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "relatedSystemId" INTEGER NOT NULL,
    "summary" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "requestedPriority" "Priority" NOT NULL,
    "itPriority" "Priority",
    "ticketOwnerId" INTEGER,
    "currentStatus" "TicketStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- Create unique index on Ticket.ticketNumber
CREATE UNIQUE INDEX "Ticket_ticketNumber_key" ON "Ticket"("ticketNumber");

-- Add foreign key constraints for Ticket
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "DevRequester"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_relatedSystemId_fkey" FOREIGN KEY ("relatedSystemId") REFERENCES "RelatedSystem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Create Attachment table
CREATE TABLE "Attachment" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "storedFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "uploaderRequesterId" INTEGER NOT NULL,
    "isRemoved" BOOLEAN NOT NULL DEFAULT false,
    "removedAt" TIMESTAMP(3),
    "removalReason" TEXT,
    "removedByRequesterId" INTEGER,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- Add foreign key constraint for Attachment
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Create TicketSequence table for atomic ticket number allocation
CREATE TABLE "TicketSequence" (
    "year" INTEGER NOT NULL,
    "lastSeq" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TicketSequence_pkey" PRIMARY KEY ("year")
);