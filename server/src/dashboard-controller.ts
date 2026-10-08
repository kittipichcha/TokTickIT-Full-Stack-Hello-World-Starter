import type { Request, Response } from "express";
import { getRequesterDashboard, getStaffDashboard } from "./dashboard-service.js";

export async function requesterDashboardHandler(_req: Request, res: Response): Promise<void> {
  try {
    res.json({ data: await getRequesterDashboard(res.locals.userId as number) });
  } catch {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } });
  }
}

export async function staffDashboardHandler(_req: Request, res: Response): Promise<void> {
  try {
    res.json({ data: await getStaffDashboard(res.locals.userId as number) });
  } catch {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } });
  }
}
