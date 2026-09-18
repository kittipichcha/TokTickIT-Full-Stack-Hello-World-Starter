# Issue #35 — Lab 2 Test-Change Mapping (DM-17 adaptation audit)

**Purpose.** #35 Rev 13 DM-17 requires the legacy-caller compatibility set to be declared,
confined, and audited. The PR #46 review (step 7) correctly asked for a per-test mapping of
every Lab 2 test adaptation. This document lists **every** change to `server/tests/lab-02/`
against the `lab3-staging` baseline (`749aa966`), classified, and confirms no behavioral
assertion was weakened or deleted.

**Baseline:** `origin/lab3-staging` @ `749aa966` (PR #45 merge).
**Commands used:**

```bash
git diff --stat origin/lab3-staging -- server/tests/lab-02/
git diff origin/lab3-staging -- server/tests/lab-02/
```

**Change classes:**

- **(a) Mechanical identity-source rename** — `prisma.devRequester.*` → `prisma.user.*` with
  `role: "REQUESTER"`, plus the extra fields required to create a `User`
  (`role`/`passwordHash`/`mustChangePassword`). No assertion semantics changed.
- **(b) Mechanical column rename** — `removedByRequesterId` → `removedByUserId` in a **DB-level**
  assertion (the service still exposes the legacy response key where Lab 2 tests assert it).
- **(c) Superseded-behavior update** — the Lab 2 schema assertion now reflects the Lab 3 final
  schema (`DevRequester` table replaced by `User`). Class-(b) precursor per DM-17: it documents
  behavior the contract deliberately supersedes.

**No deleted tests, no deleted/widened assertions.** The only removed `expect(...)` line was
replaced one-for-one (see `attachment-concurrency` below).

---

## Per-file mapping

### 1. `attachment-concurrency.integration.test.ts` (+22 / −8)
- **Class (a):** requester setup switched to `prisma.user.findFirst/findMany` with
  `role: "REQUESTER"`; `create` calls gain `role`/`passwordHash`/`mustChangePassword`.
- **Class (b):** one DB assertion —
  `expect(persisted!.removedByRequesterId).toBe(testRequesterId)` →
  `expect(persisted!.removedByUserId).toBe(testRequesterId)`.
  **Justification:** the physical column was renamed in Phase C; the assertion still verifies the
  same behavior (the remover identity is persisted) against the authoritative column. The
  user-facing response key remains `removedByRequesterId` (asserted elsewhere in Lab 2 API tests).
- **Assertions weakened/deleted:** none.

### 2. `attachment-ownership.integration.test.ts` (+21 / −7)
- **Class (a)** only (requester A/B identity setup).
- **Assertions weakened/deleted:** none.

### 3. `attachment-persistence-compensation.integration.test.ts` (+10 / −3)
- **Class (a)** only.
- **Assertions weakened/deleted:** none.

### 4. `create-ticket-real-db.integration.test.ts` (+4 / −4)
- **Class (a)** only (4 requester lookups).
- **Assertions weakened/deleted:** none.

### 5. `create-ticket-reference-validation.integration.test.ts` (+1 / −1)
- **Class (a)** only (1 requester lookup).
- **Assertions weakened/deleted:** none.

### 6. `database-migration.integration.test.ts` (+3 / −1) — **DB-01**
- **Class (c) — superseded-behavior update.** The Lab 2 forward-migration test asserted the
  presence of the `DevRequester` table. Lab 3 Phase C intentionally replaces `DevRequester` with
  `User`, so the assertion was updated:
  - `"DevRequester"` removed from the required-table list; `"User"` added.
  - A new explicit assertion documents the supersession:
    `expect(names.has("DevRequester")).toBe(false);`
- **Justification:** the Lab 2 assertion encoded a schema fact that the Lab 3 frozen contract
  (§9.3 "User (replaces `DevRequester`)") deliberately supersedes. The *behavioral* intent
  (the forward-migration tables exist, ownership is preserved) is retained; the table name is the
  changed contract surface. This is the class-(b) precursor flagged by the reviewer's step 7.
- **Assertions weakened/deleted:** none — the row-level table check is stricter, not looser.

### 7. `dev-requesters.service.test.ts` (+2 / −2)
- **Class (a):** unit mock `devRequester: { findMany }` → `user: { findMany }`; expected query
  `where` gains `role: "REQUESTER"`.
- **Assertions weakened/deleted:** none — the expected selector shape/ordering assertions are
  unchanged.

### 8. `my-tickets-real-db.integration.test.ts` (+24 / −21)
- **Class (a)** only (largest file; many requester lookups + cleanup now scoped by `role`).
- **Assertions weakened/deleted:** none.

### 9. `seed.integration.test.ts` (+4 / −4)
- **Class (a):** `prisma.devRequester.count(...)` → `prisma.user.count({ ... role: "REQUESTER" })`.
- **Assertions weakened/deleted:** none.
- **Related non-test fix:** the *seed itself* was corrected (see below) so this suite's
  `afterAll` cleanup succeeds; no assertion in this file was changed to accommodate the defect.

### 10. `ticket-number-concurrency.integration.test.ts` (+3 / −3)
- **Class (a)** only (3 requester lookups).
- **Assertions weakened/deleted:** none.

---

## Additional defect found and fixed (not an assertion change)

While capturing evidence, the full Lab 2 regression suite revealed a **real regression**
introduced by #35's seed expansion:

- **Symptom:** `tests/lab-02/seed.integration.test.ts` failed in `afterAll` with
  `23001` / `Ticket_categoryId_fkey` — `update or delete on table "Category" violates RESTRICT
  setting of foreign key constraint`.
- **Cause:** the expanded `server/prisma/seed.ts` selected ticket reference data over **all**
  rows (`prisma.category.findMany()` / `prisma.relatedSystem.findMany()`), so a seeded Ticket
  could attach to a pre-existing unrelated Category (here, the category planted by the Lab 2 seed
  test). The FK `ON DELETE RESTRICT` then blocked the test's cleanup.
- **Fix:** scope the seed's reference lookups to its own declared records
  (`where: { name: { in: CATEGORIES } }` / `{ in: RELATED_SYSTEMS.map(...) }`). Seed tickets can
  no longer reference records the seed does not own.
- **Verification:** full Lab 2 + lab-03 server suite green — **385 passed / 30 files**
  (`artifacts/lab-03/issue-35/server-vitest.txt`).

---

## Confirmation

- Lab 2 test files changed: **10** (all listed above).
- Behavioral assertions deleted: **0**.
- Behavioral assertions weakened: **0**.
- Test cases (`it`/`describe`) deleted: **0**.
- Schema assertions updated for superseded behavior: **1** (`database-migration.integration.test.ts`, DB-01), documented as class (c).
- Column-name assertions updated for the Phase C rename: **1** (`attachment-concurrency.integration.test.ts`), documented as class (b).

This document is the seed for #37 Rev 12 RR-04's `lab2-test-audit.md`, which absorbs it.
