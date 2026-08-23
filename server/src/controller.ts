import { Request, Response } from "express";
import { getActiveDevRequesters, getCategories } from "./service.js";

export async function getCategoriesHandler(req: Request, res: Response): Promise<void> {
  try {
    const categories = await getCategories();
    res.status(200).json(categories);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: errorMessage });
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
