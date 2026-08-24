import { NextFunction, Request, Response } from "express";
import { isActiveDevRequester } from "./service.js";

const INVALID_REQUESTER_CONTEXT = {
  error: { code: "REQUESTER_CONTEXT_INVALID", message: "A valid active requester is required." },
};

export function getRequesterIdFromHeaders(req: Request): number | null {
  const values = req.headers["x-dev-requester-id"];
  const headerValues = Array.isArray(values) ? values : values ? [values] : [];
  const value = headerValues[0];
  const validFormat = typeof value === "string" && /^(?:[1-9][0-9]*)$/.test(value);

  if (headerValues.length !== 1 || !validFormat) {
    return null;
  }
  return Number(value);
}

export async function requireDevRequesterContext(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const requesterId = getRequesterIdFromHeaders(req);
  if (requesterId === null) {
    res.status(422).json(INVALID_REQUESTER_CONTEXT);
    return;
  }

  try {
    const active = await isActiveDevRequester(requesterId);
    if (!active) {
      res.status(422).json(INVALID_REQUESTER_CONTEXT);
      return;
    }

    res.locals.devRequesterId = requesterId;
    next();
  } catch {
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." },
    });
  }
}