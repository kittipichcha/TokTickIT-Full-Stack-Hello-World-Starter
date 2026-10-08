/**
 * Actions Taken — HTTP handlers (Issue #51).
 *
 * Frozen authority: `docs/lab-04/api-spec.md` §3–§6.
 *
 * Identity is always read from `res.locals` (populated by #35's fresh-User
 * `requireAuth`) — never from a request body. Error mapping follows the
 * canonical Lab 3 table: 400 VALIDATION_ERROR / 404 NOT_FOUND / 409 CONFLICT /
 * 500 INTERNAL_ERROR.
 */

import { Request, Response } from "express";
import type { Role } from "@prisma/client";
import {
  listActions,
  getActionDetail,
  createAction,
  updateAction,
} from "./action-service.js";
import { validateIdempotencyKey } from "./action-validation.js";
import { ValidationError, NotFoundError, ConflictError, type AccessContext } from "./service.js";
import { MAX_DATABASE_ID } from "./id-domain.js";
import { inspectIntegerFields } from "./integer-validation.js";

const INTERNAL_ERROR_BODY = {
  error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." },
};

const NOT_FOUND_ACTION_BODY = {
  error: { code: "NOT_FOUND", message: "Action not found." },
};

/** Builds the explicit access context from the authenticated identity. */
function accessContext(res: Response): AccessContext {
  return {
    userId: res.locals.userId as number,
    role: res.locals.role as Role,
  };
}

/** Maps a service exception to the canonical error response. */
function respondWithError(res: Response, err: unknown): void {
  if (err instanceof ValidationError) {
    res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: err.message, fields: err.fields },
    });
    return;
  }
  if (err instanceof NotFoundError) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: err.message } });
    return;
  }
  if (err instanceof ConflictError) {
    res.status(409).json({ error: { code: "CONFLICT", message: err.message } });
    return;
  }
  res.status(500).json(INTERNAL_ERROR_BODY);
}

/** Rejects JSON integer tokens that JSON.parse would otherwise normalize. */
function validateRawActionIntegerFields(
  req: Request,
  res: Response,
  body: Record<string, unknown>,
  candidateFields: string[],
): boolean {
  const fieldsToInspect = candidateFields.filter((field) =>
    field === "assigneeUserId" ? body[field] !== undefined && body[field] !== null : body[field] !== undefined,
  );
  if (fieldsToInspect.length === 0) return true;

  const rawBody = (req as unknown as Record<string, unknown>).rawBody as string | undefined;
  const inspection = inspectIntegerFields(rawBody, fieldsToInspect);
  const invalidFields = new Set([...inspection.invalidFields, ...inspection.outOfRangeFields]);
  if (invalidFields.size === 0) return true;

  const fields: Record<string, string> = {};
  for (const field of invalidFields) {
    fields[field] = `${field} must be a valid positive integer.`;
  }
  res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Validation failed.", fields } });
  return false;
}

/** Parses a positive-integer path parameter within the PostgreSQL INTEGER range. */
function parsePositiveId(raw: string | undefined): number | null {
  if (raw === undefined || !/^(?:[1-9][0-9]*)$/.test(raw)) return null;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value > MAX_DATABASE_ID) return null;
  return value;
}

/** Parses a positive-integer query value; returns `null` when absent/invalid. */
function parsePositiveQuery(raw: unknown): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string" || !/^(?:[1-9][0-9]*)$/.test(value)) return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed > MAX_DATABASE_ID) return null;
  return parsed;
}

/** `GET /api/tickets/:ticketNumber/actions` (api-spec.md §3). */
export async function listActionsHandler(req: Request, res: Response): Promise<void> {
  try {
    const fields: Record<string, string> = {};

    let page = 1;
    if (req.query.page !== undefined) {
      const parsed = parsePositiveQuery(req.query.page);
      if (parsed === null) {
        fields.page = "page must be a positive integer.";
      } else {
        page = parsed;
      }
    }

    let pageSize = 10;
    if (req.query.pageSize !== undefined) {
      const parsed = parsePositiveQuery(req.query.pageSize);
      if (parsed === null || parsed > 50) {
        fields.pageSize = "pageSize must be an integer between 1 and 50.";
      } else {
        pageSize = parsed;
      }
    }

    if (Object.keys(fields).length > 0) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Validation failed.", fields } });
      return;
    }

    const result = await listActions(req.params.ticketNumber, accessContext(res), page, pageSize);
    res.status(200).json(result);
  } catch (err) {
    respondWithError(res, err);
  }
}

/** `GET /api/tickets/:ticketNumber/actions/:actionId` (api-spec.md §5). */
export async function getActionDetailHandler(req: Request, res: Response): Promise<void> {
  try {
    const actionId = parsePositiveId(req.params.actionId);
    if (actionId === null) {
      res.status(404).json(NOT_FOUND_ACTION_BODY);
      return;
    }
    const action = await getActionDetail(req.params.ticketNumber, actionId, accessContext(res));
    res.status(200).json({ data: action });
  } catch (err) {
    respondWithError(res, err);
  }
}

/** `POST /api/tickets/:ticketNumber/actions` (api-spec.md §4). */
export async function createActionHandler(req: Request, res: Response): Promise<void> {
  try {
    const idempotencyKey = validateIdempotencyKey(req.headers["idempotency-key"]);
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (!validateRawActionIntegerFields(req, res, body, ["assigneeUserId"])) return;
    const actorUserId = res.locals.userId as number;
    const result = await createAction(req.params.ticketNumber, actorUserId, idempotencyKey, body);
    res.status(result.status).json(result.body);
  } catch (err) {
    respondWithError(res, err);
  }
}

/** `PATCH /api/tickets/:ticketNumber/actions/:actionId` (api-spec.md §6). */
export async function updateActionHandler(req: Request, res: Response): Promise<void> {
  try {
    const actionId = parsePositiveId(req.params.actionId);
    if (actionId === null) {
      res.status(404).json(NOT_FOUND_ACTION_BODY);
      return;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (!validateRawActionIntegerFields(req, res, body, ["expectedVersion", "assigneeUserId"])) return;
    const actorUserId = res.locals.userId as number;
    const action = await updateAction(req.params.ticketNumber, actionId, actorUserId, body);
    res.status(200).json({ data: action });
  } catch (err) {
    respondWithError(res, err);
  }
}
