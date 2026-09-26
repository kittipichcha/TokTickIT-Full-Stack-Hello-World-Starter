# Integrated Lab 3 schema catalog audit

Read-only PostgreSQL catalog snapshot: [`schema-catalog.json`](schema-catalog.json), captured on 2026-09-25 from the user-authorized temporary Lab 3 database at baseline `77d810b`. `server` Prisma validation also passed. This snapshot is not a Lab 2 upgrade test and does not satisfy REL-12.

| Model | Observed catalog columns |
|---|---|
| `User` (9) | `id`, `name`, `email`, `role`, `passwordHash`, `isActive`, `mustChangePassword`, `createdAt`, `updatedAt` |
| `Ticket` (14) | `id`, `ticketNumber`, `requesterId`, `categoryId`, `relatedSystemId`, `summary`, `description`, `requestedPriority`, `itPriority`, `ticketOwnerId`, `currentStatus`, `createdAt`, `updatedAt`, `appearsResolved` |
| `Attachment` (12) | `id`, `ticketId`, `originalFilename`, `storedFilename`, `mimeType`, `fileSizeBytes`, `isRemoved`, `removedAt`, `removalReason`, `uploadedAt`, `uploaderUserId`, `removedByUserId` |
| `Comment` / `InternalNote` (5 each) | `id`, `ticketId`, `authorId`, `content`, `createdAt` |
| `Category` / `RelatedSystem` (4 each) | `id`, `name`, `createdAt`, `isActive` (catalog order differs for RelatedSystem) |
| `TicketSequence` (2) | `year`, `lastSeq` |

Catalog assertions observed:

- All ten model timestamp columns (`Attachment.removedAt`, `Attachment.uploadedAt`, `Category.createdAt`, `Comment.createdAt`, `InternalNote.createdAt`, `RelatedSystem.createdAt`, `Ticket.createdAt`, `Ticket.updatedAt`, `User.createdAt`, `User.updatedAt`) use `timestamp with time zone`; `removedAt` is nullable and the rest are non-null.
- The three enums have exactly 3 `Priority`, 3 `Role`, and 8 `TicketStatus` labels matching the frozen values.
- The four frozen non-unique `Ticket` indexes (`requesterId`, `currentStatus`, `createdAt`, `ticketOwnerId`) exist; no `itPriority` index exists. The catalog also shows primary/unique indexes, including unique ticket number and user email.
- `Attachment.isRemoved` exists; no `DevRequester` table or legacy `uploaderRequesterId` / `removedByRequesterId` column appears (`migrationResidue` is empty).
- Foreign-key delete actions are `RESTRICT` or `SET NULL`; none is `CASCADE`.
- Catalog JSON contains 55 selected columns, 20 indexes, 69 constraints, and 14 enum labels.

The remaining row-preservation and migration behavior is covered by #35's isolated Lab 2 scratch proof, while a fresh integrated REL-12 run remains blocked by the temporary role's lack of `CREATEDB`.
