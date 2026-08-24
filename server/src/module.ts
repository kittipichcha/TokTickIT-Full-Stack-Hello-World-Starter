import { Router } from "express";
import { getCategoriesHandler, getDevRequestersHandler, getRequesterContextHandler, healthHandler } from "./controller.js";
import { requireDevRequesterContext } from "./requester-context.js";

export const router = Router();

router.get("/health", (req, res) => { void healthHandler(req, res); });

// Categories endpoint
router.get("/categories", getCategoriesHandler);

router.get("/dev-requesters", getDevRequestersHandler);

router.get("/requester-context", requireDevRequesterContext, getRequesterContextHandler);
