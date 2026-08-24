import { Request, Response } from "express";
import { checkHealth, getActiveDevRequesters, getCategories } from "./service.js";

export async function healthHandler(req: Request, res: Response): Promise<void> {
  const result = await checkHealth();
  res.status(result.status === "ok" ? 200 : 503).json(result);
}

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

export function getRequesterContextHandler(req: Request, res: Response): void {
  res.status(200).json({ data: { requesterId: res.locals.devRequesterId as number } });
}
