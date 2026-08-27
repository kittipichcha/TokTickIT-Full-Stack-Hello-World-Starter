import { Request, Response } from "express";
import {
  getActiveDevRequesters,
  getActiveRelatedSystems,
  getCategories,
  createTicket,
  getTicketByNumber,
  getMyTickets,
  categoryExists,
  isActiveCategory,
  ValidationError,
  InactiveReferenceError,
} from "./service.js";
import { TicketSequenceExhaustedError } from "./ticket-number.js";
import { inspectIntegerFields } from "./integer-validation.js";

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
    // Use exact media-type parsing: "application/json" is valid, "application/json; charset=utf-8" is valid,
    // but "application/json-invalid" is not.
    const contentType = (req.headers["content-type"] ?? "").toLowerCase();
    const mediaType = contentType.split(";")[0]?.trim() ?? "";
    if (mediaType !== "application/json") {
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
    const inspection = inspectIntegerFields(rawBody, ["categoryId", "relatedSystemId"]);
    
    // Invalid lexical fields return 400
    if (inspection.invalidFields.length > 0) {
      const fields: Record<string, string> = {};
      for (const f of inspection.invalidFields) {
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
    
    // Positive out-of-range references return 409 (no fields envelope)
    if (inspection.outOfRangeFields.length > 0) {
      const field = inspection.outOfRangeFields[0];
      const message =
        field === "categoryId"
          ? "The specified category does not exist or is inactive."
          : "The specified related system does not exist or is inactive.";
      res.status(409).json({
        error: {
          code: "INACTIVE_REFERENCE",
          message,
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

export async function getMyTicketsHandler(req: Request, res: Response): Promise<void> {
  try {
    const requesterId = res.locals.devRequesterId as number;

    // Parse query params
    const rawSearch = typeof req.query.search === "string" ? req.query.search : "";
    const search = rawSearch.trim();
    const activeSearch = search.length > 0 ? search : undefined;

    // categoryId: malformed → 400
    let categoryId: number | undefined;
    if (req.query.categoryId !== undefined) {
      const raw = req.query.categoryId;
      if (typeof raw !== "string" || !/^(?:[1-9][0-9]*)$/.test(raw)) {
        res.status(400).json({
          error: { code: "VALIDATION_ERROR", message: "Validation failed.", fields: { categoryId: "categoryId must be a valid positive integer." } },
        });
        return;
      }
      categoryId = Number(raw);
    }

    // requestedPriority: invalid enum → 400
    let requestedPriority: string | undefined;
    if (req.query.requestedPriority !== undefined) {
      const raw = req.query.requestedPriority;
      if (typeof raw !== "string" || !["LOW", "MEDIUM", "HIGH"].includes(raw)) {
        res.status(400).json({
          error: { code: "VALIDATION_ERROR", message: "Validation failed.", fields: { requestedPriority: "requestedPriority must be one of LOW, MEDIUM, HIGH." } },
        });
        return;
      }
      requestedPriority = raw;
    }

    // status: invalid enum → 400
    let status: string | undefined;
    if (req.query.status !== undefined) {
      const raw = req.query.status;
      if (typeof raw !== "string" || raw !== "NEW") {
        res.status(400).json({
          error: { code: "VALIDATION_ERROR", message: "Validation failed.", fields: { status: "status must be NEW." } },
        });
        return;
      }
      status = raw;
    }

    // sort: invalid → fall back to createdAt (not an error)
    const validSorts = ["createdAt", "ticketNumber", "summary", "requestedPriority"];
    const rawSort = typeof req.query.sort === "string" ? req.query.sort : "";
    const sort = validSorts.includes(rawSort) ? rawSort : "createdAt";

    // order: invalid → fall back to desc (not an error)
    const rawOrder = typeof req.query.order === "string" ? req.query.order : "";
    const order = rawOrder === "asc" || rawOrder === "desc" ? rawOrder : "desc";

    // page: missing/malformed/non-positive → fall back to 1 (not an error)
    let page = 1;
    if (req.query.page !== undefined) {
      const raw = req.query.page;
      if (typeof raw === "string" && /^(?:[1-9][0-9]*)$/.test(raw)) {
        page = Number(raw);
      }
      // else fall back to 1
    }

    // pageSize: invalid/out of range → fall back to 10 (not an error)
    let pageSize = 10;
    if (req.query.pageSize !== undefined) {
      const raw = req.query.pageSize;
      if (typeof raw === "string" && /^(?:[1-9][0-9]*)$/.test(raw)) {
        const n = Number(raw);
        if (n >= 1 && n <= 50) {
          pageSize = n;
        }
      }
      // else fall back to 10
    }

    // Validate categoryId exists and is active → 409 if not
    if (categoryId !== undefined) {
      const exists = await categoryExists(categoryId);
      if (!exists) {
        res.status(409).json({
          error: { code: "INACTIVE_REFERENCE", message: "The specified category does not exist or is inactive." },
        });
        return;
      }
      const active = await isActiveCategory(categoryId);
      if (!active) {
        res.status(409).json({
          error: { code: "INACTIVE_REFERENCE", message: "The specified category does not exist or is inactive." },
        });
        return;
      }
    }

    const result = await getMyTickets(requesterId, {
      search: activeSearch,
      categoryId,
      requestedPriority,
      status,
      sort,
      order,
      page,
      pageSize,
    });

    res.status(200).json(result);
  } catch (err) {
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
