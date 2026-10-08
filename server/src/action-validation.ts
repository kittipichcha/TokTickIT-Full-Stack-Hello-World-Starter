/**
 * Actions Taken — pure validation and normalization (Issue #51).
 *
 * Frozen authority: `docs/lab-04/api-spec.md` §2/§4/§6 and
 * `docs/lab-04/specification.md` §5 (BR-03/BR-05/BR-06/BR-25).
 *
 * This module is pure: no I/O, no Prisma, no framework imports. It owns the
 * field bounds, the trim/normalize rules, the create-hash input, and the
 * combined-state validation used by PATCH. The service layer persists the
 * normalized values this module returns.
 */

import { createHash } from "node:crypto";
import { ValidationError } from "./service.js";
import { MAX_DATABASE_ID } from "./id-domain.js";

/** Action lifecycle (specification.md §7). */
export type ActionStatus = "PENDING" | "COMPLETED" | "CANCELLED";

export const ACTION_STATUSES: readonly ActionStatus[] = ["PENDING", "COMPLETED", "CANCELLED"];

/** Field bounds (api-spec.md §2). */
export const MAX_ACTION_DESCRIPTION = 2000;
export const MAX_ACTION_RESULT = 2000;
export const MAX_ACTION_NOTE = 1000;

/** Idempotency-Key grammar: 1–128 printable ASCII characters (api-spec.md §4). */
export const MAX_IDEMPOTENCY_KEY_LENGTH = 128;
const IDEMPOTENCY_KEY_PATTERN = /^[\x20-\x7E]{1,128}$/;

/** The six recognized, ordered create fields (api-spec.md §4). */
export interface NormalizedActionFields {
  description: string;
  result: string | null;
  followUpRequired: boolean;
  followUpNote: string | null;
  attachmentNotes: string | null;
  assigneeUserId: number | null;
}

/** True when `status` is a terminal Action state (BR-04). */
export function isTerminalActionStatus(status: ActionStatus): boolean {
  return status === "COMPLETED" || status === "CANCELLED";
}

/** True when `value` is one of the three frozen Action statuses. */
export function isActionStatus(value: unknown): value is ActionStatus {
  return typeof value === "string" && (ACTION_STATUSES as readonly string[]).includes(value);
}

/**
 * Normalizes optional text: trims, and maps absent/null/blank to `null`.
 * Throws `ValidationError` when the trimmed value exceeds `maxLength`.
 */
function normalizeOptionalText(
  raw: unknown,
  field: string,
  maxLength: number,
): string | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "string") {
    throw new ValidationError("Validation failed.", { [field]: `${field} must be a string or null.` });
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > maxLength) {
    throw new ValidationError("Validation failed.", {
      [field]: `${field} must be at most ${maxLength} characters.`,
    });
  }
  return trimmed;
}

/** Validates the required Action Description (1–2,000 after trim). */
export function validateActionDescription(raw: unknown): string {
  if (typeof raw !== "string") {
    throw new ValidationError("Validation failed.", {
      description: "description is required and must be a string.",
    });
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new ValidationError("Validation failed.", {
      description: "description must not be empty or whitespace-only.",
    });
  }
  if (trimmed.length > MAX_ACTION_DESCRIPTION) {
    throw new ValidationError("Validation failed.", {
      description: `description must be at most ${MAX_ACTION_DESCRIPTION} characters.`,
    });
  }
  return trimmed;
}

/** Validates optional Result text (≤2,000 after trim). */
export function validateActionResult(raw: unknown): string | null {
  return normalizeOptionalText(raw, "result", MAX_ACTION_RESULT);
}

/** Validates optional Follow-up Note text (≤1,000 after trim). */
export function validateActionFollowUpNote(raw: unknown): string | null {
  return normalizeOptionalText(raw, "followUpNote", MAX_ACTION_NOTE);
}

/** Validates optional Attachment Notes text (≤1,000 after trim). */
export function validateActionAttachmentNotes(raw: unknown): string | null {
  return normalizeOptionalText(raw, "attachmentNotes", MAX_ACTION_NOTE);
}

/**
 * Validates `followUpRequired`. Absent defaults to `false`; an explicit `null`
 * or any non-boolean value fails (api-spec.md §4).
 */
export function validateActionFollowUpRequired(raw: unknown): boolean {
  if (raw === undefined) return false;
  if (typeof raw !== "boolean") {
    throw new ValidationError("Validation failed.", {
      followUpRequired: "followUpRequired must be a boolean.",
    });
  }
  return raw;
}

/**
 * Validates `assigneeUserId`. Absent/null → `null`; otherwise a positive JSON
 * integer within the PostgreSQL INTEGER range.
 */
export function validateActionAssigneeUserId(raw: unknown): number | null {
  if (raw === undefined || raw === null) return null;
  if (
    typeof raw !== "number" ||
    !Number.isInteger(raw) ||
    raw <= 0 ||
    raw > MAX_DATABASE_ID
  ) {
    throw new ValidationError("Validation failed.", {
      assigneeUserId: "assigneeUserId must be a valid positive integer.",
    });
  }
  return raw;
}

/**
 * Normalizes the recognized create fields in their frozen order and validates
 * the resulting Action. Unknown and server-owned fields are ignored by the
 * caller before this function is invoked.
 */
export function normalizeCreateActionInput(body: Record<string, unknown>): NormalizedActionFields {
  const normalized: NormalizedActionFields = {
    description: validateActionDescription(body.description),
    result: validateActionResult(body.result),
    followUpRequired: validateActionFollowUpRequired(body.followUpRequired),
    followUpNote: validateActionFollowUpNote(body.followUpNote),
    attachmentNotes: validateActionAttachmentNotes(body.attachmentNotes),
    assigneeUserId: validateActionAssigneeUserId(body.assigneeUserId),
  };
  validateFollowUpDependency(normalized.followUpRequired, normalized.followUpNote);
  return normalized;
}

/** Enforces BR-05: `followUpRequired=true` requires a nonblank Follow-up Note. */
export function validateFollowUpDependency(followUpRequired: boolean, followUpNote: string | null): void {
  if (followUpRequired && (followUpNote === null || followUpNote.length === 0)) {
    throw new ValidationError("Validation failed.", {
      followUpNote: "followUpNote is required when followUpRequired is true.",
    });
  }
}

/**
 * SHA-256 (lowercase hex) of the UTF-8 `JSON.stringify` of the normalized,
 * ordered create fields (api-spec.md §4). Two canonical-equivalent requests
 * therefore hash identically.
 */
export function hashCreateActionInput(normalized: NormalizedActionFields): string {
  const ordered = {
    description: normalized.description,
    result: normalized.result,
    followUpRequired: normalized.followUpRequired,
    followUpNote: normalized.followUpNote,
    attachmentNotes: normalized.attachmentNotes,
    assigneeUserId: normalized.assigneeUserId,
  };
  return createHash("sha256").update(JSON.stringify(ordered), "utf-8").digest("hex");
}

/** Validates the mandatory `Idempotency-Key` header (api-spec.md §4). */
export function validateIdempotencyKey(raw: unknown): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string" || !IDEMPOTENCY_KEY_PATTERN.test(value)) {
    throw new ValidationError("Validation failed.", {
      "Idempotency-Key": `Idempotency-Key must be 1–${MAX_IDEMPOTENCY_KEY_LENGTH} printable ASCII characters.`,
    });
  }
  return value;
}

/** Validates the required positive `expectedVersion` (api-spec.md §6). */
export function validateExpectedVersion(raw: unknown): number {
  if (
    typeof raw !== "number" ||
    !Number.isInteger(raw) ||
    raw <= 0 ||
    raw > MAX_DATABASE_ID
  ) {
    throw new ValidationError("Validation failed.", {
      expectedVersion: "expectedVersion must be a valid positive integer.",
    });
  }
  return raw;
}

/** The editable PATCH fields (api-spec.md §6). */
export const EDITABLE_ACTION_FIELDS = [
  "description",
  "result",
  "followUpRequired",
  "followUpNote",
  "attachmentNotes",
  "assigneeUserId",
  "status",
] as const;

export interface ActionPatch {
  description?: string;
  result?: string | null;
  followUpRequired?: boolean;
  followUpNote?: string | null;
  attachmentNotes?: string | null;
  assigneeUserId?: number | null;
  status?: ActionStatus;
}

/**
 * Parses a PATCH body into the recognized editable fields.
 *
 * Requires at least one recognized editable field (api-spec.md §6). Unknown
 * fields are ignored. `status` may remain `PENDING` or transition once to
 * `COMPLETED`/`CANCELLED`; the transition legality is enforced by the service
 * against the current status.
 */
export function parseActionPatch(body: Record<string, unknown>): ActionPatch {
  const patch: ActionPatch = {};
  let recognized = 0;

  if ("description" in body) {
    patch.description = validateActionDescription(body.description);
    recognized++;
  }
  if ("result" in body) {
    patch.result = validateActionResult(body.result);
    recognized++;
  }
  if ("followUpRequired" in body) {
    patch.followUpRequired = validateActionFollowUpRequired(body.followUpRequired);
    recognized++;
  }
  if ("followUpNote" in body) {
    patch.followUpNote = validateActionFollowUpNote(body.followUpNote);
    recognized++;
  }
  if ("attachmentNotes" in body) {
    patch.attachmentNotes = validateActionAttachmentNotes(body.attachmentNotes);
    recognized++;
  }
  if ("assigneeUserId" in body) {
    patch.assigneeUserId = validateActionAssigneeUserId(body.assigneeUserId);
    recognized++;
  }
  if ("status" in body) {
    if (!isActionStatus(body.status)) {
      throw new ValidationError("Validation failed.", {
        status: `status must be one of ${ACTION_STATUSES.join(", ")}.`,
      });
    }
    patch.status = body.status;
    recognized++;
  }

  if (recognized === 0) {
    throw new ValidationError("Validation failed.", {
      body: "At least one editable field is required.",
    });
  }
  return patch;
}

/**
 * Validates the combined resulting Action state after applying a PATCH.
 *
 * Enforces BR-05: a `COMPLETED` Action requires a nonblank Result, and
 * `followUpRequired=true` requires a nonblank Follow-up Note.
 */
export function validateCombinedActionState(state: {
  description: string;
  result: string | null;
  followUpRequired: boolean;
  followUpNote: string | null;
  attachmentNotes: string | null;
  status: ActionStatus;
}): void {
  validateActionDescription(state.description);
  if (state.result !== null && state.result.length > MAX_ACTION_RESULT) {
    throw new ValidationError("Validation failed.", {
      result: `result must be at most ${MAX_ACTION_RESULT} characters.`,
    });
  }
  if (state.attachmentNotes !== null && state.attachmentNotes.length > MAX_ACTION_NOTE) {
    throw new ValidationError("Validation failed.", {
      attachmentNotes: `attachmentNotes must be at most ${MAX_ACTION_NOTE} characters.`,
    });
  }
  validateFollowUpDependency(state.followUpRequired, state.followUpNote);
  if (state.status === "COMPLETED" && (state.result === null || state.result.length === 0)) {
    throw new ValidationError("Validation failed.", {
      result: "result is required when completing an Action.",
    });
  }
}

/** The complete editable-field snapshot stored in an Action revision (BR-06). */
export interface ActionFieldSnapshot {
  description: string;
  result: string | null;
  followUpRequired: boolean;
  followUpNote: string | null;
  attachmentNotes: string | null;
  assigneeUserId: number | null;
  status: ActionStatus;
}

/** Builds the ordered editable-field snapshot for revision storage. */
export function toActionSnapshot(state: ActionFieldSnapshot): ActionFieldSnapshot {
  return {
    description: state.description,
    result: state.result,
    followUpRequired: state.followUpRequired,
    followUpNote: state.followUpNote,
    attachmentNotes: state.attachmentNotes,
    assigneeUserId: state.assigneeUserId,
    status: state.status,
  };
}
