/**
 * Role + ownership authorization middleware (Issue #37 — Lab 3 authorization).
 *
 * These are the shared authorization primitives consumed by #37's Requester
 * retrofit and by downstream issues (#38 Staff queue, #41 Admin screens).
 *
 * Identity convention (frozen): `res.locals.userId`, `res.locals.role`,
 * `res.locals.mustChangePassword` are populated by #35's `requireAuth` from the
 * CURRENT `User` row on every request. This module never reads the session and
 * never caches role state.
 *
 * Gate rejections (frozen §0 canonical table):
 *   - authenticated but role not permitted -> 403 FORBIDDEN
 *   - Requester requesting a resource they do not own -> 404 NOT_FOUND
 *     (never 403 — no existence leak, BR-32)
 */

import { NextFunction, Request, Response } from "express";
import type { Role } from "@prisma/client";
import { MAX_DATABASE_ID } from "./id-domain.js";
import { attachmentOwnedByRequester, ticketOwnedByRequester } from "./service.js";

const FORBIDDEN_BODY = {
  error: { code: "FORBIDDEN", message: "You do not have permission to perform this action." },
};

const NOT_FOUND_TICKET_BODY = {
  error: { code: "NOT_FOUND", message: "Ticket not found." },
};

const NOT_FOUND_ATTACHMENT_BODY = {
  error: { code: "NOT_FOUND", message: "Attachment not found." },
};

const UNAUTHENTICATED_BODY = {
  error: { code: "UNAUTHENTICATED", message: "Authentication required." },
};

const INTERNAL_ERROR_BODY = {
  error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." },
};

const TICKET_NUMBER_PATTERN = /^TKT-\d{4}-\d{6}$/;

/** Roles permitted to read any Ticket / Attachment (view-only). */
const STAFF_ROLES: readonly Role[] = ["IT_STAFF", "ADMINISTRATOR"];

/**
 * Parses and validates an `attachmentId` path parameter.
 *
 * Mirrors the controller's parser: beyond the decimal grammar, the value must be
 * a safe integer within the PostgreSQL `INTEGER` range so an oversized digit
 * string can never reach Prisma and produce a `500`. Returns `null` when the ID
 * is malformed or out of range.
 */
function parseAttachmentId(rawId: string): number | null {
  if (!/^(?:[1-9][0-9]*)$/.test(rawId)) return null;
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id > MAX_DATABASE_ID) return null;
  return id;
}

/**
 * `requireRole(allowedRoles)` — generic role gate.
 *
 * Assumes `requireAuth` has already run (so `res.locals.role` is the current DB
 * role). An authenticated caller whose role is not listed receives
 * `403 FORBIDDEN`. A missing identity is treated as unauthenticated (`401`).
 */
export function requireRole(allowedRoles: readonly Role[]) {
  return function requireRoleMiddleware(_req: Request, res: Response, next: NextFunction): void {
    const role = res.locals.role as Role | undefined;
    if (role === undefined) {
      res.status(401).json(UNAUTHENTICATED_BODY);
      return;
    }
    if (!allowedRoles.includes(role)) {
      res.status(403).json(FORBIDDEN_BODY);
      return;
    }
    next();
  };
}

/**
 * `requireTicketReadAccess` — shared Ticket-detail read authorization.
 *
 * IT Staff / Administrator may read any Ticket. A Requester may read only a
 * Ticket they own; a non-owned or missing Ticket returns `404 NOT_FOUND`
 * (never `403` — no existence leak, BR-32).
 *
 * This is the route-layer gate. The service-layer read function applies the
 * same ownership rule via an explicit access context, so a Staff/Admin request
 * that passes here is not then rejected inside the service.
 */
export async function requireTicketReadAccess(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const role = res.locals.role as Role | undefined;
    const userId = res.locals.userId as number | undefined;
    if (role === undefined || userId === undefined) {
      res.status(401).json(UNAUTHENTICATED_BODY);
      return;
    }

    const ticketNumber = req.params.ticketNumber;
    if (!TICKET_NUMBER_PATTERN.test(ticketNumber)) {
      res.status(404).json(NOT_FOUND_TICKET_BODY);
      return;
    }

    if (STAFF_ROLES.includes(role)) {
      next();
      return;
    }

    const owned = await ticketOwnedByRequester(ticketNumber, userId);
    if (!owned) {
      res.status(404).json(NOT_FOUND_TICKET_BODY);
      return;
    }

    next();
  } catch {
    res.status(500).json(INTERNAL_ERROR_BODY);
  }
}

/**
 * `authorizeAttachmentReadByRoleOrRequesterOwnership` — shared Attachment-read
 * authorization for the three shared read routes:
 *
 *   - `GET /api/tickets/:ticketNumber/attachments`   (ticketNumber param)
 *   - `GET /api/attachments/:attachmentId/download`  (attachmentId param)
 *   - `GET /api/attachments/:attachmentId/preview`   (attachmentId param)
 *
 * IT Staff / Administrator may read any Attachment. A Requester may read only
 * Attachments belonging to a Ticket they own; otherwise `404 NOT_FOUND`
 * (never `403` — no existence leak, BR-32).
 *
 * Upload and soft-remove are NOT covered here: those stay Requester-owner-only
 * (see `requireRole(["REQUESTER"])` plus the service-layer ownership check).
 */
export async function authorizeAttachmentReadByRoleOrRequesterOwnership(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const role = res.locals.role as Role | undefined;
    const userId = res.locals.userId as number | undefined;
    if (role === undefined || userId === undefined) {
      res.status(401).json(UNAUTHENTICATED_BODY);
      return;
    }

    if (STAFF_ROLES.includes(role)) {
      next();
      return;
    }

    // Requester: resolve ownership from whichever path parameter this route uses.
    const ticketNumber = req.params.ticketNumber;
    if (ticketNumber !== undefined) {
      if (!TICKET_NUMBER_PATTERN.test(ticketNumber)) {
        res.status(404).json(NOT_FOUND_TICKET_BODY);
        return;
      }
      const owned = await ticketOwnedByRequester(ticketNumber, userId);
      if (!owned) {
        res.status(404).json(NOT_FOUND_TICKET_BODY);
        return;
      }
      next();
      return;
    }

    const rawAttachmentId = req.params.attachmentId;
    const attachmentId = rawAttachmentId === undefined ? null : parseAttachmentId(rawAttachmentId);
    if (attachmentId === null) {
      res.status(404).json(NOT_FOUND_ATTACHMENT_BODY);
      return;
    }

    const owned = await attachmentOwnedByRequester(attachmentId, userId);
    if (!owned) {
      res.status(404).json(NOT_FOUND_ATTACHMENT_BODY);
      return;
    }

    next();
  } catch {
    res.status(500).json(INTERNAL_ERROR_BODY);
  }
}