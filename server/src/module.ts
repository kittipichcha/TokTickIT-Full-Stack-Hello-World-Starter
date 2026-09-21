import { Router } from "express";
import multer from "multer";
import {
  getCategoriesHandler,
  getRelatedSystemsHandler,
  createTicketHandler,
  getMyTicketsHandler,
  getTicketDetailHandler,
  uploadAttachmentHandler,
  listAttachmentsHandler,
  downloadAttachmentHandler,
  previewAttachmentHandler,
  removeAttachmentHandler,
  requireTicketOwnership,
} from "./controller.js";
import {
  requireRole,
  requireTicketReadAccess,
  authorizeAttachmentReadByRoleOrRequesterOwnership,
} from "./authorization.js";
import {
  requireAuth,
  requireAuthAndCsrf,
  requireCsrf,
  requirePasswordChanged,
} from "./session.js";
import {
  login,
  logout,
  me,
  changePasswordHandler,
  appContext,
} from "./auth.controller.js";
import {
  listUsersHandler,
  createUserHandler,
  updateUserHandler,
  setInitialPasswordHandler,
} from "./admin-controller.js";

export const router = Router();

// ---- Lab 3 auth endpoints (Issue #35) ----
// Gate exemptions (frozen): login public; me/logout/change-password authenticated,
// content-gate-exempt. logout/change-password are state-changing -> requireAuth + requireCsrf.
router.post("/auth/login", login);
router.get("/auth/me", requireAuth, me);
router.post("/auth/logout", requireAuthAndCsrf, logout);
router.post("/auth/change-password", requireAuthAndCsrf, changePasswordHandler);

// ---- Lab 3 normal-application entry (Issue #35) ----
// The minimal protected endpoint that enforces the mandatory-password-change gate
// (BR-02 / AC-02): requireAuth -> requirePasswordChanged -> handler.
router.get("/app/context", requireAuth, requirePasswordChanged, appContext);

const upload = multer({
  storage: multer.memoryStorage(),
  // Transport-level guard: set slightly above the business maximum (5,000,000 bytes)
  // so that a valid 5,000,000-byte file reaches the service-level validateFileSize().
  // The authoritative business limit is enforced by service.validateFileSize().
  limits: { fileSize: 5_000_001 },
});

// ---- Reference data (Issue #37) ----
// Authenticated session required (api-spec §5, §6); no role restriction.
router.get("/categories", requireAuth, requirePasswordChanged, getCategoriesHandler);
router.get("/related-systems", requireAuth, requirePasswordChanged, getRelatedSystemsHandler);

// ---- Requester Ticket routes (Issue #37 retrofit) ----
// My Tickets: authenticated Requester only. The role gate is distinct from the
// ownership-scoped query — Staff/Admin receive 403 FORBIDDEN, never an empty list.
router.get(
  "/tickets",
  requireAuth,
  requirePasswordChanged,
  requireRole(["REQUESTER"]),
  getMyTicketsHandler,
);

// Create Ticket: authenticated Requester; state-changing -> CSRF required.
router.post(
  "/tickets",
  requireAuth,
  requirePasswordChanged,
  requireCsrf,
  requireRole(["REQUESTER"]),
  createTicketHandler,
);

// Ticket Detail: shared read — owner Requester or IT Staff/Administrator.
router.get(
  "/tickets/:ticketNumber",
  requireAuth,
  requirePasswordChanged,
  requireTicketReadAccess,
  getTicketDetailHandler,
);

// ---- Attachment routes (Issue #37 retrofit) ----
// Upload: Requester-owner-only mutation (BR-12); Staff/Admin are view-only (403).
router.post(
  "/tickets/:ticketNumber/attachments",
  requireAuth,
  requirePasswordChanged,
  requireCsrf,
  requireRole(["REQUESTER"]),
  requireTicketOwnership,
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

// Shared attachment reads: owner Requester or IT Staff/Administrator.
router.get(
  "/tickets/:ticketNumber/attachments",
  requireAuth,
  requirePasswordChanged,
  authorizeAttachmentReadByRoleOrRequesterOwnership,
  listAttachmentsHandler,
);
router.get(
  "/attachments/:attachmentId/download",
  requireAuth,
  requirePasswordChanged,
  authorizeAttachmentReadByRoleOrRequesterOwnership,
  downloadAttachmentHandler,
);
router.get(
  "/attachments/:attachmentId/preview",
  requireAuth,
  requirePasswordChanged,
  authorizeAttachmentReadByRoleOrRequesterOwnership,
  previewAttachmentHandler,
);

// Soft-remove: Requester-owner-only mutation (BR-12); Staff/Admin are view-only (403).
router.delete(
  "/attachments/:attachmentId",
  requireAuth,
  requirePasswordChanged,
  requireCsrf,
  requireRole(["REQUESTER"]),
  removeAttachmentHandler,
);

// ---- Administrator user management (Issue #41) ----
// All four routes are Administrator-only (AC-20). The three mutations additionally
// require CSRF (api-spec §0). `actingUserId` is taken from the session by the handler.
router.get(
  "/admin/users",
  requireAuth,
  requirePasswordChanged,
  requireRole(["ADMINISTRATOR"]),
  listUsersHandler,
);
router.post(
  "/admin/users",
  requireAuth,
  requirePasswordChanged,
  requireCsrf,
  requireRole(["ADMINISTRATOR"]),
  createUserHandler,
);
router.patch(
  "/admin/users/:userId",
  requireAuth,
  requirePasswordChanged,
  requireCsrf,
  requireRole(["ADMINISTRATOR"]),
  updateUserHandler,
);
router.post(
  "/admin/users/:userId/initial-password",
  requireAuth,
  requirePasswordChanged,
  requireCsrf,
  requireRole(["ADMINISTRATOR"]),
  setInitialPasswordHandler,
);
