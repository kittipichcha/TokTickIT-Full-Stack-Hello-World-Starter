/**
 * Administrator user-management controller (Issue #41 — Lab 3).
 *
 * Maps the four frozen admin endpoints (api-spec §24–§27) onto the service layer and
 * translates service exceptions into the canonical error-code contract (api-spec §0):
 *
 *   400 VALIDATION_ERROR   — field/body validation failure
 *   403 FORBIDDEN          — role gate (enforced by #37's `requireRole` middleware)
 *   404 NOT_FOUND          — target user does not exist
 *   409 CONFLICT           — duplicate email / self-deactivation / last-admin guard
 *   500 INTERNAL_ERROR     — unexpected failure, including retry exhaustion
 *
 * `actingUserId` is sourced from `res.locals.userId` ONLY (populated by #35's
 * fresh-User `requireAuth` from the current DB row) — never from the request body.
 */

import { Request, Response } from "express";
import {
  listUsers,
  createUser,
  updateUser,
  setInitialPassword,
  NotFoundError,
  SerializationRetryExhaustedError,
} from "./admin-service.js";
import { ValidationError, ConflictError } from "./service.js";

/** Canonical 500 body (frozen §0). */
function sendInternalError(res: Response): void {
  if (res.headersSent) return;
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } });
}

/** Canonical 400 body. */
function sendValidationError(res: Response, err: ValidationError): void {
  res.status(400).json({ error: { code: "VALIDATION_ERROR", message: err.message, fields: err.fields } });
}

/** Canonical 409 body. */
function sendConflict(res: Response, err: ConflictError): void {
  res.status(409).json({ error: { code: "CONFLICT", message: err.message } });
}

/** Canonical 404 body. */
function sendNotFound(res: Response, err: NotFoundError): void {
  res.status(404).json({ error: { code: "NOT_FOUND", message: err.message } });
}

/**
 * Parses a `:userId` path parameter.
 *
 * Beyond the decimal grammar, the value must be a safe integer within the PostgreSQL
 * `INTEGER` range so an oversized digit string can never reach Prisma and produce a
 * `500`. Returns `null` when the ID is malformed or out of range — the caller then
 * responds `404 NOT_FOUND` (the resource cannot exist).
 */
function parseUserId(raw: string | undefined): number | null {
  if (raw === undefined || !/^(?:[1-9][0-9]*)$/.test(raw)) return null;
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id > 2_147_483_647) return null;
  return id;
}

/** GET /api/admin/users — list/search/filter (AC-15). */
export async function listUsersHandler(req: Request, res: Response): Promise<void> {
  try {
    const data = await listUsers({
      search: req.query.search,
      role: req.query.role,
    });
    res.status(200).json({ data });
  } catch {
    sendInternalError(res);
  }
}

/** POST /api/admin/users — create user (AC-16). */
export async function createUserHandler(req: Request, res: Response): Promise<void> {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const data = await createUser({
      name: body.name,
      email: body.email,
      role: body.role,
      isActive: body.isActive,
      initialPassword: body.initialPassword,
    });
    res.status(201).json({ data });
  } catch (err) {
    if (err instanceof ValidationError) return sendValidationError(res, err);
    if (err instanceof ConflictError) return sendConflict(res, err);
    sendInternalError(res);
  }
}

/** PATCH /api/admin/users/:userId — edit user (AC-17..AC-19). */
export async function updateUserHandler(req: Request, res: Response): Promise<void> {
  try {
    const userId = parseUserId(req.params.userId);
    if (userId === null) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "User not found." } });
      return;
    }

    // Identity comes from the authenticated session only (never the body).
    const actingUserId = res.locals.userId as number;

    const body = (req.body ?? {}) as Record<string, unknown>;
    const data = await updateUser(
      userId,
      {
        name: body.name,
        email: body.email,
        role: body.role,
        isActive: body.isActive,
      },
      actingUserId,
    );
    res.status(200).json({ data });
  } catch (err) {
    if (err instanceof ValidationError) return sendValidationError(res, err);
    if (err instanceof NotFoundError) return sendNotFound(res, err);
    if (err instanceof ConflictError) return sendConflict(res, err);
    if (err instanceof SerializationRetryExhaustedError) return sendInternalError(res);
    sendInternalError(res);
  }
}

/** POST /api/admin/users/:userId/initial-password — reset initial password (AC-16). */
export async function setInitialPasswordHandler(req: Request, res: Response): Promise<void> {
  try {
    const userId = parseUserId(req.params.userId);
    if (userId === null) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "User not found." } });
      return;
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const data = await setInitialPassword(userId, body.initialPassword);
    res.status(200).json({ data });
  } catch (err) {
    if (err instanceof ValidationError) return sendValidationError(res, err);
    if (err instanceof NotFoundError) return sendNotFound(res, err);
    sendInternalError(res);
  }
}