import { Router } from "express";
import { getHealth, getCategoriesHandler } from "./controller.js";

export const router = Router();

// Health check endpoint
router.get("/health", getHealth);

// Categories endpoint
router.get("/categories", getCategoriesHandler);
