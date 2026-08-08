import { Router } from "express";
import { getHealth } from "./controller.js";

export const router = Router();

// Health check endpoint
router.get("/health", getHealth);
