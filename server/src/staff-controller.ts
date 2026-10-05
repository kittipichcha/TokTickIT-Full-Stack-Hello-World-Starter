/**
 * IT Staff ticket-operation handlers (Issue #38).
 *
 * Covers the Staff Queue (api-spec §15), Staff Ticket Detail (§16), ownership
 * (§17), IT Priority (§18), status transitions (§19), Public Comments (§20/§21),
 * Internal Notes (§22/§23), and the Requester appears-resolved indicator (§20a).
 *
 * Identity is always read from `res.locals` (populated by #35's fresh-User
 * `requireAuth`) — never from a request body. Error mapping follows the
 * canonical api-spec §0 table: 400 VALIDATION_ERROR / 403 FORBIDDEN /
 * 404 NOT_FOUND / 409 CONFLICT / 500 INTERNAL_ERROR.
 */

import { Request, Response } from "express";
import {
  getStaffQueue,
  parseQueueQuery,
  getStaffTicketDetail,
  listAssignableOwners,
  createComment,
  listComments,
  createNote,
  listNotes,
  setAppearsResolved,
  ValidationError,
  NotFoundError,
  ConflictError,
  type AccessContext,
} from "./service.js";
import { inspectIntegerFields } from "./integer-validation.js";
import { MAX_DATABASE_ID } from "./id-domain.js";
import {
  applyStatusTransition,
  listTicketStatusHistory,
  setItPriority,
  setTicketOwner,
} from "./ticket-workflow-service.js";
import type { Role } from "@prisma/client";

const TICKET_NUMBER_PATTERN = /^TKT-\d{4}-\d{6}$/;

const INTERNAL_ERROR_BODY = {
  error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." },
};

const NOT_FOUND_TICKET_BODY = {
  error: { code: "NOT_FOUND", message: "Ticket not found." },
};

/** Validates expectedVersion's raw JSON integer token while preserving omission compatibility. */
function validateExpectedVersion(req: Request, res: Response, body: Record<string, unknown>): boolean {
  if (body.expectedVersion === undefined) return true;
  const rawBody = (req as unknown as Record<string, unknown>).rawBody as string | undefined;
  const inspection = inspectIntegerFields(rawBody, ["expectedVersion"]);
  if (inspection.invalidFields.length === 0 && inspection.outOfRangeFields.length === 0) return true;
  res.status(400).json({
    error: {
      code: "VALIDATION_ERROR",
      message: "Validation failed.",
      fields: { expectedVersion: "expectedVersion must be a valid positive integer." },
    },
  });
  return false;
}

function positiveQueryInteger(raw: unknown): number | null {
  if (typeof raw !== "string" || !/^[1-9][0-9]*$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value <= MAX_DATABASE_ID ? value : null;
}

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

/** `GET /api/staff/queue` (api-spec §15). */
export async function staffQueueHandler(req: Request, res: Response): Promise<void> {
  try {
    const params = parseQueueQuery(req.query);
    const result = await getStaffQueue(params);
    res.status(200).json(result);
  } catch {
    res.status(500).json(INTERNAL_ERROR_BODY);
  }
}

/** `GET /api/staff/tickets/:ticketNumber` (api-spec §16). */
export async function getStaffTicketDetailHandler(req: Request, res: Response): Promise<void> {
  try {
    const ticketNumber = req.params.ticketNumber;
    if (!TICKET_NUMBER_PATTERN.test(ticketNumber)) {
      res.status(404).json(NOT_FOUND_TICKET_BODY);
      return;
    }
    const ticket = await getStaffTicketDetail(ticketNumber);
    if (!ticket) {
      res.status(404).json(NOT_FOUND_TICKET_BODY);
      return;
    }
    res.status(200).json({ data: ticket });
  } catch {
    res.status(500).json(INTERNAL_ERROR_BODY);
  }
}

/** `GET /api/staff/owners` (api-spec §17a). IT Staff / Administrator only. */
export async function listAssignableOwnersHandler(_req: Request, res: Response): Promise<void> {
  try {
    const owners = await listAssignableOwners();
    res.status(200).json({ data: owners });
  } catch {
    res.status(500).json(INTERNAL_ERROR_BODY);
  }
}

/** `POST /api/staff/tickets/:ticketNumber/owner` (api-spec §17). */
export async function setOwnerHandler(req: Request, res: Response): Promise<void> {
  try {
    const ticketNumber = req.params.ticketNumber;
    if (!TICKET_NUMBER_PATTERN.test(ticketNumber)) {
      res.status(404).json(NOT_FOUND_TICKET_BODY);
      return;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (!validateExpectedVersion(req, res, body)) return;
    const result = await setTicketOwner(ticketNumber, body.ownerId, body.expectedVersion);
    res.status(200).json({ data: result });
  } catch (err) {
    respondWithError(res, err);
  }
}

/** `PATCH /api/staff/tickets/:ticketNumber/priority` (api-spec §18). */
export async function setItPriorityHandler(req: Request, res: Response): Promise<void> {
  try {
    const ticketNumber = req.params.ticketNumber;
    if (!TICKET_NUMBER_PATTERN.test(ticketNumber)) {
      res.status(404).json(NOT_FOUND_TICKET_BODY);
      return;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (!validateExpectedVersion(req, res, body)) return;
    const result = await setItPriority(ticketNumber, body.itPriority, body.expectedVersion);
    res.status(200).json({ data: result });
  } catch (err) {
    respondWithError(res, err);
  }
}

/** `PATCH /api/staff/tickets/:ticketNumber/status` (api-spec §19). */
export async function applyStatusTransitionHandler(req: Request, res: Response): Promise<void> {
  try {
    const ticketNumber = req.params.ticketNumber;
    if (!TICKET_NUMBER_PATTERN.test(ticketNumber)) {
      res.status(404).json(NOT_FOUND_TICKET_BODY);
      return;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (!validateExpectedVersion(req, res, body)) return;
    const result = await applyStatusTransition(
      ticketNumber,
      body.status,
      body.expectedVersion,
      res.locals.userId as number,
    );
    res.status(200).json({ data: result });
  } catch (err) {
    respondWithError(res, err);
  }
}

/** `GET /api/staff/tickets/:ticketNumber/status-history` (api-spec §9). */
export async function listTicketStatusHistoryHandler(req: Request, res: Response): Promise<void> {
  try {
    const ticketNumber = req.params.ticketNumber;
    if (!TICKET_NUMBER_PATTERN.test(ticketNumber)) {
      res.status(404).json(NOT_FOUND_TICKET_BODY);
      return;
    }
    const page = req.query.page === undefined ? 1 : positiveQueryInteger(req.query.page);
    const pageSize = req.query.pageSize === undefined ? 10 : positiveQueryInteger(req.query.pageSize);
    const fields: Record<string, string> = {};
    if (page === null) fields.page = "page must be a positive integer.";
    if (pageSize === null || pageSize > 50) fields.pageSize = "pageSize must be an integer between 1 and 50.";
    if (Object.keys(fields).length) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Validation failed.", fields } });
      return;
    }
    const result = await listTicketStatusHistory(ticketNumber, page as number, pageSize as number);
    res.status(200).json(result);
  } catch (err) {
    respondWithError(res, err);
  }
}

/** `POST /api/tickets/:ticketNumber/comments` (api-spec §20). */
export async function createCommentHandler(req: Request, res: Response): Promise<void> {
  try {
    const ticketNumber = req.params.ticketNumber;
    if (!TICKET_NUMBER_PATTERN.test(ticketNumber)) {
      res.status(404).json(NOT_FOUND_TICKET_BODY);
      return;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const comment = await createComment(ticketNumber, accessContext(res), body.content);
    res.status(201).json({ data: comment });
  } catch (err) {
    respondWithError(res, err);
  }
}

/** `GET /api/tickets/:ticketNumber/comments` (api-spec §21). */
export async function listCommentsHandler(req: Request, res: Response): Promise<void> {
  try {
    const ticketNumber = req.params.ticketNumber;
    if (!TICKET_NUMBER_PATTERN.test(ticketNumber)) {
      res.status(404).json(NOT_FOUND_TICKET_BODY);
      return;
    }
    const comments = await listComments(ticketNumber, accessContext(res));
    res.status(200).json({ data: comments });
  } catch (err) {
    respondWithError(res, err);
  }
}

/** `POST /api/staff/tickets/:ticketNumber/notes` (api-spec §22). */
export async function createNoteHandler(req: Request, res: Response): Promise<void> {
  try {
    const ticketNumber = req.params.ticketNumber;
    if (!TICKET_NUMBER_PATTERN.test(ticketNumber)) {
      res.status(404).json(NOT_FOUND_TICKET_BODY);
      return;
    }
    const authorId = res.locals.userId as number;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const note = await createNote(ticketNumber, authorId, body.content);
    res.status(201).json({ data: note });
  } catch (err) {
    respondWithError(res, err);
  }
}

/** `GET /api/staff/tickets/:ticketNumber/notes` (api-spec §23). */
export async function listNotesHandler(req: Request, res: Response): Promise<void> {
  try {
    const ticketNumber = req.params.ticketNumber;
    if (!TICKET_NUMBER_PATTERN.test(ticketNumber)) {
      res.status(404).json(NOT_FOUND_TICKET_BODY);
      return;
    }
    const notes = await listNotes(ticketNumber);
    res.status(200).json({ data: notes });
  } catch (err) {
    respondWithError(res, err);
  }
}

/** `POST /api/tickets/:ticketNumber/appears-resolved` (api-spec §20a). */
export async function setAppearsResolvedHandler(req: Request, res: Response): Promise<void> {
  try {
    const ticketNumber = req.params.ticketNumber;
    if (!TICKET_NUMBER_PATTERN.test(ticketNumber)) {
      res.status(404).json(NOT_FOUND_TICKET_BODY);
      return;
    }
    const requesterId = res.locals.userId as number;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const result = await setAppearsResolved(ticketNumber, requesterId, body.appearsResolved);
    res.status(200).json({ data: result });
  } catch (err) {
    respondWithError(res, err);
  }
}
