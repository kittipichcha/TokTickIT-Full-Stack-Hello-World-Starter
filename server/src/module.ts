import { Router } from "express";
import multer from "multer";
import {
  getCategoriesHandler,
  getDevRequestersHandler,
  getRelatedSystemsHandler,
  getRequesterContextHandler,
  createTicketHandler,
  getMyTicketsHandler,
  getTicketDetailHandler,
  uploadAttachmentHandler,
  listAttachmentsHandler,
  downloadAttachmentHandler,
  previewAttachmentHandler,
  removeAttachmentHandler,
} from "./controller.js";
import { requireDevRequesterContext } from "./requester-context.js";

export const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5_000_000 },
});

// Categories endpoint
router.get("/categories", getCategoriesHandler);

router.get("/dev-requesters", getDevRequestersHandler);

router.get("/related-systems", getRelatedSystemsHandler);

router.get("/requester-context", requireDevRequesterContext, getRequesterContextHandler);

// Ticket endpoints
router.get("/tickets", requireDevRequesterContext, getMyTicketsHandler);
router.post("/tickets", requireDevRequesterContext, createTicketHandler);
router.get("/tickets/:ticketNumber", requireDevRequesterContext, getTicketDetailHandler);

// Attachment endpoints
router.post(
  "/tickets/:ticketNumber/attachments",
  requireDevRequesterContext,
  (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === "LIMIT_FILE_SIZE") {
            res.status(413).json({
              error: { code: "FILE_TOO_LARGE", message: "File exceeds the maximum allowed size." },
            });
            return;
          }
          res.status(400).json({
            error: { code: "VALIDATION_ERROR", message: err.message, fields: {} },
          });
          return;
        }
        res.status(500).json({
          error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." },
        });
        return;
      }
      // Attach the file info to the request for the handler
      if (req.file) {
        (req as unknown as Record<string, unknown>).uploadedFile = {
          buffer: req.file.buffer,
          originalname: req.file.originalname,
        };
      }
      next();
    });
  },
  uploadAttachmentHandler,
);
router.get(
  "/tickets/:ticketNumber/attachments",
  requireDevRequesterContext,
  listAttachmentsHandler,
);
router.get(
  "/attachments/:attachmentId/download",
  requireDevRequesterContext,
  downloadAttachmentHandler,
);
router.get(
  "/attachments/:attachmentId/preview",
  requireDevRequesterContext,
  previewAttachmentHandler,
);
router.delete(
  "/attachments/:attachmentId",
  requireDevRequesterContext,
  removeAttachmentHandler,
);
