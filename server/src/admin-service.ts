/**
 * Administrator user-management service (Issue #41 — Lab 3).
 *
 * Implements the four frozen endpoints' business logic (api-spec §24–§27):
 *   - listUsers            GET    /api/admin/users
 *   - createUser           POST   /api/admin/users
 *   - updateUser           PATCH  /api/admin/users/:userId
 *   - setInitialPassword   POST   /api/admin/users/:userId/initial-password
 *
 * Frozen safety rules (Issue #41 body / specification.md BR-13, BR-25–BR-30, BR-34):
 *   1. duplicate email on create            -> 409 CONFLICT
 *   2. duplicate email on edit              -> 409 CONFLICT (another user's email only)
 *   3. invalid role                         -> 400 VALIDATION_ERROR
 *   4. self-deactivation                    -> 409 CONFLICT (BR-27)
 *   5. last active Administrator deactivate -> 409 CONFLICT (BR-28)
 *   6. last active Administrator demote     -> 409 CONFLICT (BR-28)
 *   7. non-Administrator access             -> 403 FORBIDDEN (route layer, #37)
 *   8. exactly one role per User            -> schema-enforced scalar `role Role`
 *   9. non-last Administrator self-demote   -> succeeds (BR-34)
 *  10. nonexistent userId                   -> 404 NOT_FOUND
 *
 * Password hashing/policy is REUSED from #35's `auth-service.ts` — never reimplemented.
 *
 * Session authority (Amendment): #41 consumes #35's fresh-User rule. `actingUserId` is
 * supplied by the controller from `res.locals.userId` (current DB value per request);
 * this service never reads a session snapshot and builds no session-invalidation
 * mechanism. The last-admin guard operates purely on DB state.
 */

import { Prisma, Role } from "@prisma/client";
import { getPrisma } from "./prisma.js";
import { hashPassword, validatePasswordPolicy } from "./auth-service.js";
import { ValidationError, ConflictError } from "./service.js";
import { testSeams } from "./test-seams.js";

/** Raised when the target user does not exist. The controller maps this to 404. */
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

// ---------------------------------------------------------------------------
// Operation-specific DTOs (frozen — prior review §7.3).
//
// Each operation declares its own explicit `select`, so `passwordHash` is
// structurally absent from every response regardless of which endpoint runs.
// ---------------------------------------------------------------------------

export interface AdminUserListItem {
  id: number;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
}

export type AdminUserCreateResult = AdminUserListItem & { mustChangePassword: true };
export type AdminUserEditResult = AdminUserListItem;
export interface InitialPasswordResult {
  id: number;
  mustChangePassword: true;
}

/** The frozen `Role` enum values, used for exact-match validation and filtering. */
const ROLE_VALUES: readonly Role[] = ["REQUESTER", "IT_STAFF", "ADMINISTRATOR"];

const NAME_MIN = 1;
const NAME_MAX = 200;

/** The frozen email grammar (mirrors #35's login validation). */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Normalizes an email exactly as the frozen §9.3 rule requires. */
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Pure role-filter parser (api-spec §24).
 *
 * Returns the role only when the value matches the `Role` enum exactly; any
 * unrecognized value (including `undefined`) yields `undefined` — "no filter
 * applied", never a validation error. Mirrors #38's `parseQueueQuery` convention.
 */
export function parseRoleFilter(value: unknown): Role | undefined {
  if (typeof value !== "string") return undefined;
  return ROLE_VALUES.includes(value as Role) ? (value as Role) : undefined;
}

/** Validates a `name` value (trimmed, non-empty, 1–200 chars). Returns the trimmed value. */
function validateName(raw: unknown, fields: Record<string, string>): string | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw !== "string") {
    fields.name = "Name must be a string.";
    return undefined;
  }
  const trimmed = raw.trim();
  if (trimmed.length < NAME_MIN || trimmed.length > NAME_MAX) {
    fields.name = `Name must be between ${NAME_MIN} and ${NAME_MAX} characters.`;
    return undefined;
  }
  return trimmed;
}

/** Validates an `email` value (normalized, valid format). Returns the normalized value. */
function validateEmail(raw: unknown, fields: Record<string, string>): string | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw !== "string") {
    fields.email = "Email must be a string.";
    return undefined;
  }
  const normalized = normalizeEmail(raw);
  if (!EMAIL_RE.test(normalized)) {
    fields.email = "A valid email is required.";
    return undefined;
  }
  return normalized;
}

/** Validates a `role` value (exact enum match). Returns the role. */
function validateRole(raw: unknown, fields: Record<string, string>): Role | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw !== "string" || !ROLE_VALUES.includes(raw as Role)) {
    fields.role = "Role must be one of REQUESTER, IT_STAFF, ADMINISTRATOR.";
    return undefined;
  }
  return raw as Role;
}

/** Validates an `isActive` value (boolean). Returns the boolean. */
function validateIsActive(raw: unknown, fields: Record<string, string>): boolean | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw !== "boolean") {
    fields.isActive = "isActive must be a boolean.";
    return undefined;
  }
  return raw;
}

/** Validates an `initialPassword` value against the frozen policy. Returns the password. */
function validateInitialPassword(raw: unknown, fields: Record<string, string>): string | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw !== "string") {
    fields.initialPassword = "Initial password must be a string.";
    return undefined;
  }
  const policyError = validatePasswordPolicy(raw);
  if (policyError) {
    fields.initialPassword = policyError;
    return undefined;
  }
  return raw;
}

/** True when a Prisma error is a unique-constraint violation (P2002). */
function isUniqueConstraintViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

/** True when a Prisma error is a transaction serialization failure (P2034). */
function isSerializationFailure(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034";
}

/** The safe duplicate-email conflict message (identical on the pre-check and P2002 paths). */
const DUPLICATE_EMAIL_MESSAGE = "A user with this email address already exists.";

// ---------------------------------------------------------------------------
// Feature 1 — User list, search, role filter (FR-21/22/23, AC-15)
// ---------------------------------------------------------------------------

/**
 * Lists users with optional case-insensitive name/email substring search and an
 * exact-match role filter. An unrecognized `role` value applies no filter (never 400).
 *
 * The `select` is operation-specific: `{id, name, email, role, isActive}` — the frozen
 * list shape, with `passwordHash` and `mustChangePassword` structurally excluded.
 */
export async function listUsers(params: {
  search?: unknown;
  role?: unknown;
}): Promise<AdminUserListItem[]> {
  const prisma = getPrisma();

  const where: Prisma.UserWhereInput = {};

  if (typeof params.search === "string" && params.search.trim() !== "") {
    const term = params.search.trim();
    where.OR = [
      { name: { contains: term, mode: "insensitive" } },
      { email: { contains: term, mode: "insensitive" } },
    ];
  }

  const role = parseRoleFilter(params.role);
  if (role !== undefined) {
    where.role = role;
  }

  return prisma.user.findMany({
    where,
    select: { id: true, name: true, email: true, role: true, isActive: true },
    orderBy: { id: "asc" },
  });
}

// ---------------------------------------------------------------------------
// Last-active-Administrator guard (BR-28 / BR-34)
// ---------------------------------------------------------------------------

/**
 * Counts active Administrators using the supplied client.
 *
 * Called ONLY from inside the Serializable transaction below — a pre-check outside
 * the transaction would not close the two-concurrent-demotions race.
 */
export async function countActiveAdministrators(
  tx: Prisma.TransactionClient,
): Promise<number> {
  return tx.user.count({ where: { role: "ADMINISTRATOR", isActive: true } });
}

/** Bounded retry attempts for the Serializable last-admin guard (frozen: 1–3). */
const SERIALIZABLE_MAX_ATTEMPTS = 3;

/**
 * Raised when every Serializable attempt failed at the database/transaction layer
 * before the business rule could be evaluated. The controller maps this to
 * `500 INTERNAL_ERROR` (deterministic exhaustion rule — prior review §7.5).
 */
export class SerializationRetryExhaustedError extends Error {
  constructor() {
    super("The operation could not be completed due to repeated transaction conflicts.");
    this.name = "SerializationRetryExhaustedError";
  }
}

/**
 * Runs `fn` inside a Serializable transaction, retrying a bounded number of times on
 * a Postgres serialization failure (`40001`, surfaced by Prisma as `P2034`).
 *
 * Business errors thrown by `fn` (ValidationError / ConflictError) propagate
 * immediately — they are never retried. Only the transaction-layer serialization
 * failure is retried. If every attempt fails at that layer, the deterministic
 * `SerializationRetryExhaustedError` is thrown.
 */
async function runSerializableWithRetry<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  const prisma = getPrisma();

  for (let attempt = 0; attempt < SERIALIZABLE_MAX_ATTEMPTS; attempt++) {
    try {
      return await prisma.$transaction(fn, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (err) {
      if (isSerializationFailure(err)) {
        continue;
      }
      throw err;
    }
  }

  throw new SerializationRetryExhaustedError();
}

// ---------------------------------------------------------------------------
// Feature 2 — Create user (FR-24, BR-25, BR-30, AC-16)
// ---------------------------------------------------------------------------

/**
 * Creates a user with exactly one role and an initial password.
 *
 * Validation: `name` (trimmed, 1–200), `email` (normalized, valid, unique),
 * `role` (exact enum), `initialPassword` (frozen policy), `isActive` (boolean).
 * The created user always has `mustChangePassword = true` (BR-30).
 *
 * Duplicate email is rejected with `409 CONFLICT` via the pre-check; a concurrent
 * create that slips past the check-then-write window is caught as Prisma `P2002`
 * on the email unique index and mapped to the same `409` (Rev 8 — F-41-2).
 */
export async function createUser(input: {
  name?: unknown;
  email?: unknown;
  role?: unknown;
  isActive?: unknown;
  initialPassword?: unknown;
}): Promise<AdminUserCreateResult> {
  const fields: Record<string, string> = {};

  const name = validateName(input.name, fields);
  if (input.name === undefined) fields.name = "Name is required.";

  const email = validateEmail(input.email, fields);
  if (input.email === undefined) fields.email = "Email is required.";

  const role = validateRole(input.role, fields);
  if (input.role === undefined) fields.role = "Role is required.";

  const initialPassword = validateInitialPassword(input.initialPassword, fields);
  if (input.initialPassword === undefined) {
    fields.initialPassword = "Initial password is required.";
  }

  const isActive = validateIsActive(input.isActive, fields);

  if (Object.keys(fields).length > 0) {
    throw new ValidationError("Validation failed.", fields);
  }

  const prisma = getPrisma();

  // Pre-check for the clear field-level message. The DB unique index is the final
  // authority (see the P2002 catch below).
  const existing = await prisma.user.findUnique({ where: { email: email! }, select: { id: true } });
  if (existing) {
    throw new ConflictError(DUPLICATE_EMAIL_MESSAGE);
  }

  const passwordHash = await hashPassword(initialPassword!);

  try {
    return await prisma.user.create({
      data: {
        name: name!,
        email: email!,
        role: role!,
        passwordHash,
        isActive: isActive ?? true,
        mustChangePassword: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        mustChangePassword: true,
      },
    }) as AdminUserCreateResult;
  } catch (err) {
    if (isUniqueConstraintViolation(err)) {
      throw new ConflictError(DUPLICATE_EMAIL_MESSAGE);
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Feature 3 — Edit user (FR-25, BR-13, BR-26, BR-27, BR-28, BR-34, AC-17..19)
// ---------------------------------------------------------------------------

/**
 * Updates a user's name/email/role/activation state.
 *
 * Partial-update semantics (Rev 8 — F-41-3, resolved per specification.md's
 * closed-contract policy): omitted fields are left unchanged; an empty/no-op body is
 * a valid no-op returning the current row. Unknown properties (including
 * `passwordHash`) are ignored exactly — they never trigger a 400 and never reach the
 * stored hash.
 *
 * Safety rules:
 *   - `404 NOT_FOUND` when the target user does not exist.
 *   - `409 CONFLICT` on duplicate email (another user's normalized email). The
 *     target's own unchanged/case-variant email is NOT a duplicate (Rev 8 — F-41-1).
 *   - `409 CONFLICT` on self-deactivation (BR-27).
 *   - `409 CONFLICT` on deactivation or demotion of the last active Administrator
 *     (BR-28), enforced inside a Serializable transaction with a bounded retry.
 *   - A non-last Administrator may change their own role away from Administrator
 *     (BR-34).
 */
export async function updateUser(
  userId: number,
  patch: {
    name?: unknown;
    email?: unknown;
    role?: unknown;
    isActive?: unknown;
  },
  actingUserId: number,
): Promise<AdminUserEditResult> {
  const fields: Record<string, string> = {};

  const name = validateName(patch.name, fields);
  const email = validateEmail(patch.email, fields);
  const role = validateRole(patch.role, fields);
  const isActive = validateIsActive(patch.isActive, fields);

  if (Object.keys(fields).length > 0) {
    throw new ValidationError("Validation failed.", fields);
  }

  const prisma = getPrisma();

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, isActive: true },
  });
  if (!target) {
    throw new NotFoundError("User not found.");
  }

  // Duplicate-email pre-check — excludes the target's own row (Rev 8 — F-41-1).
  if (email !== undefined) {
    const collision = await prisma.user.findFirst({
      where: { email, NOT: { id: userId } },
      select: { id: true },
    });
    if (collision) {
      throw new ConflictError(DUPLICATE_EMAIL_MESSAGE);
    }
  }

  // Self-deactivation is always rejected (BR-27).
  if (isActive === false && userId === actingUserId) {
    throw new ConflictError("You cannot deactivate your own account.");
  }

  // Determine whether this patch can affect the last-active-Administrator invariant.
  //
  // The invariant is "the active-Administrator count never becomes zero". Only an edit
  // that removes Administrator status from a CURRENTLY ACTIVE Administrator can reduce
  // that count:
  //   - active Administrator -> inactive          (deactivation)
  //   - active Administrator -> non-Administrator (demotion)
  //
  // An INACTIVE Administrator is already excluded from the count, so demoting or
  // deactivating them cannot reduce it and must not be blocked by the guard.
  const deactivatesAdmin =
    isActive === false && target.isActive === true && target.role === "ADMINISTRATOR";
  const demotes =
    role !== undefined &&
    role !== "ADMINISTRATOR" &&
    target.role === "ADMINISTRATOR" &&
    target.isActive === true;
  const touchesLastAdminInvariant = deactivatesAdmin || demotes;

  const data: Prisma.UserUpdateInput = {};
  if (name !== undefined) data.name = name;
  if (email !== undefined) data.email = email;
  if (role !== undefined) data.role = role;
  if (isActive !== undefined) data.isActive = isActive;

  const editSelect = {
    id: true,
    name: true,
    email: true,
    role: true,
    isActive: true,
  } as const;

  // No-op patch: nothing to write. Return the current row (200).
  if (Object.keys(data).length === 0) {
    return prisma.user.findUniqueOrThrow({ where: { id: userId }, select: editSelect });
  }

  if (!touchesLastAdminInvariant) {
    // Normal write — cannot affect the last-admin invariant.
    try {
      return await prisma.user.update({ where: { id: userId }, data, select: editSelect });
    } catch (err) {
      if (isUniqueConstraintViolation(err)) {
        throw new ConflictError(DUPLICATE_EMAIL_MESSAGE);
      }
      throw err;
    }
  }

  // Serializable guard: the count-check and the write run in one Serializable
  // transaction so two concurrent demotions of the last two Administrators cannot
  // both commit (BR-28).
  try {
    return await runSerializableWithRetry(async (tx) => {
      const activeAdmins = await countActiveAdministrators(tx);

      // Test-only interleaving hook (Issue #41): lets a test force two concurrent
      // demotions to both read the pre-write count, exercising the race the
      // Serializable isolation level must reject. Inert outside NODE_ENV=test.
      if (process.env.NODE_ENV === "test" && testSeams.beforeLastAdminWrite) {
        await testSeams.beforeLastAdminWrite();
      }

      if (deactivatesAdmin && activeAdmins <= 1) {
        throw new ConflictError("The last active Administrator cannot be deactivated.");
      }
      if (demotes && activeAdmins <= 1) {
        throw new ConflictError(
          "The last active Administrator's role cannot be changed to a non-Administrator role.",
        );
      }

      return tx.user.update({ where: { id: userId }, data, select: editSelect });
    });
  } catch (err) {
    if (isUniqueConstraintViolation(err)) {
      throw new ConflictError(DUPLICATE_EMAIL_MESSAGE);
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Feature 4 — Initial password reset (FR-26, BR-30, AC-16)
// ---------------------------------------------------------------------------

/**
 * Sets a new initial password and marks the user as requiring a change at next login.
 *
 * Runs as a normal (non-Serializable) write: resetting a password does not deactivate
 * a user, change a role, or affect the last-active-Administrator invariant, so it does
 * not participate in the last-admin concurrency guard.
 */
export async function setInitialPassword(
  userId: number,
  newPassword: unknown,
): Promise<InitialPasswordResult> {
  const fields: Record<string, string> = {};
  const password = validateInitialPassword(newPassword, fields);
  if (newPassword === undefined) {
    fields.initialPassword = "Initial password is required.";
  }
  if (Object.keys(fields).length > 0) {
    throw new ValidationError("Validation failed.", fields);
  }

  const prisma = getPrisma();

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!target) {
    throw new NotFoundError("User not found.");
  }

  const passwordHash = await hashPassword(password!);

  return prisma.user.update({
    where: { id: userId },
    data: { passwordHash, mustChangePassword: true },
    select: { id: true, mustChangePassword: true },
  }) as Promise<InitialPasswordResult>;
}