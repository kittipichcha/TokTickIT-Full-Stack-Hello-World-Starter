import { Router } from "express";
import {
  getCategoriesHandler,
  getDevRequestersHandler,
  getRelatedSystemsHandler,
  getRequesterContextHandler,
  createTicketHandler,
  getMyTicketsHandler,
  getTicketDetailHandler,
} from "./controller.js";
import { requireDevRequesterContext } from "./requester-context.js";

export const router = Router();

// Categories endpoint
router.get("/categories", getCategoriesHandler);

router.get("/dev-requesters", getDevRequestersHandler);

router.get("/related-systems", getRelatedSystemsHandler);

router.get("/requester-context", requireDevRequesterContext, getRequesterContextHandler);

// Ticket endpoints
router.get("/tickets", requireDevRequesterContext, getMyTicketsHandler);
router.post("/tickets", requireDevRequesterContext, createTicketHandler);
router.get("/tickets/:ticketNumber", requireDevRequesterContext, getTicketDetailHandler);
