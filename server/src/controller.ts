import { Request, Response } from "express";
import { checkHealth } from "./service.js";

export async function getHealth(req: Request, res: Response): Promise<void> {
  const healthStatus = await checkHealth();
  
  if (healthStatus.status === "ok") {
    res.status(200).json(healthStatus);
  } else {
    res.status(503).json(healthStatus);
  }
}
