-- Add isActive column to Category table with default true (forward migration)
ALTER TABLE "Category" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
