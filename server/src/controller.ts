import { Request, Response } from "express";
import {
  getActiveDevRequesters,
  getActiveRelatedSystems,
  getCategories,
  createTicket,
  getTicketByNumber,
  ValidationError,
  InactiveReferenceError,
} from "./service.js";
import { TicketSequenceExhaustedError } from "./ticket-number.js";
import { validateIntegerFields } from "./integer-validation.js";

export async function getCategoriesHandler(req: Request, res: Response): Promise<void> {
  try {
    const categories = await getCategories();
    res.status(200).json(categories);
  } catch {
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." },
    });
  }
}

export async function getDevRequestersHandler(req: Request, res: Response): Promise<void> {
  try {
    const requesters = await getActiveDevRequesters();
    res.status(200).json({ data: requesters });
  } catch {
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." },
    });
  }
}

export async function getRelatedSystemsHandler(req: Request, res: Response): Promise<void> {
  try {
    const systems = await getActiveRelatedSystems();
    res.status(200).json({ data: systems });
  } catch {
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." },
    });
  }
}

export function getRequesterContextHandler(req: Request, res: Response): void {
  res.status(200).json({ data: { requesterId: res.locals.devRequesterId as number } });
}

export async function createTicketHandler(req: Request, res: Response): Promise<void> {
  try {
    // Enforce frozen JSON request-parsing contract (API §0)
    const contentType = req.headers["content-type"] ?? "";
    if (!contentType.toLowerCase().startsWith("application/json")) {
      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Request body must be a JSON object.",
          fields: {},
        },
      });
      return;
    }

    if (req.body === undefined || req.body === null || typeof req.body !== "object" || Array.isArray(req.body)) {
      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Request body must be a JSON object.",
          fields: {},
        },
      });
      return;
    }

    // Integer lexical validation: reject 1.0, 1e0, etc. per api-spec §0
    const rawBody = (req as unknown as Record<string, unknown>).rawBody as string | undefined;
    const invalidIntFields = validateIntegerFields(rawBody, ["categoryId", "relatedSystemId"]);
    if (invalidIntFields.length > 0) {
      const fields: Record<string, string> = {};
      for (const f of invalidIntFields) {
        fields[f] = `${f} must be a valid integer.`;
      }
      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Validation failed.",
          fields,
        },
      });
      return;
    }

    const requesterId = res.locals.devRequesterId as number;
    const ticket = await createTicket(requesterId, req.body);
    res.status(201).json({ data: ticket });
  } catch (err) {
    if (err instanceof ValidationError) {
      res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: err.message, fields: err.fields },
      });
      return;
    }
    if (err instanceof InactiveReferenceError) {
      res.status(409).json({
        error: { code: "INACTIVE_REFERENCE", message: err.message },
      });
      return;
    }
    if (err instanceof TicketSequenceExhaustedError) {
      res.status(409).json({
        error: { code: "TICKET_SEQUENCE_EXHAUSTED", message: err.message },
      });
      return;
    }
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." },
    });
  }
}

export async function getTicketDetailHandler(req: Request, res: Response): Promise<void> {
  try {
    const requesterId = res.locals.devRequesterId as number;
    const ticketNumber = req.params.ticketNumber;

    // Validate ticketNumber format
    if (!/^TKT-\d{4}-\d{6}$/.test(ticketNumber)) {
      res.status(404).json({
        error: { code: "NOT_FOUND", message: "Ticket not found." },
      });
      return;
    }

    const ticket = await getTicketByNumber(ticketNumber, requesterId);
    if (!ticket) {
      res.status(404).json({
        error: { code: "NOT_FOUND", message: "Ticket not found." },
      });
      return;
    }

    res.status(200).json({ data: ticket });
  } catch {
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." },
    });
  }
}
