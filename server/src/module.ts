import { Router } from "express";
import { getHealth, getCategoriesHandler, getDevRequestersHandler, getRequesterContextHandler } from "./controller.js";
import { requireDevRequesterContext } from "./requester-context.js";

export const router = Router();

// Health check endpoint
router.get("/health", getHealth);

// Categories endpoint
router.get("/categories", getCategoriesHandler);

router.get("/dev-requesters", getDevRequestersHandler);

router.get("/requester-context", requireDevRequesterContext, getRequesterContextHandler);
