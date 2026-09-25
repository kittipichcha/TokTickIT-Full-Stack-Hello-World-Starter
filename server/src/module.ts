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
  staffQueueHandler,
  getStaffTicketDetailHandler,
  setOwnerHandler,
  listAssignableOwnersHandler,
  setItPriorityHandler,
  applyStatusTransitionHandler,
  createCommentHandler,
  listCommentsHandler,
  createNoteHandler,
  listNotesHandler,
  setAppearsResolvedHandler,
} from "./staff-controller.js";
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

// ---- IT Staff ticket operations (Issue #38) ----
// Queue: IT Staff / Administrator only (api-spec §15). Reads carry no CSRF.
router.get(
  "/staff/queue",
  requireAuth,
  requirePasswordChanged,
  requireRole(["IT_STAFF", "ADMINISTRATOR"]),
  staffQueueHandler,
);

// Staff Ticket Detail: IT Staff / Administrator only (api-spec §16).
router.get(
  "/staff/tickets/:ticketNumber",
  requireAuth,
  requirePasswordChanged,
  requireRole(["IT_STAFF", "ADMINISTRATOR"]),
  getStaffTicketDetailHandler,
);

// Eligible Ticket owners: IT Staff / Administrator only (api-spec §17a). Read -> no CSRF.
// Read-only source for the Queue owner filter and the Staff Detail ownership control.
router.get(
  "/staff/owners",
  requireAuth,
  requirePasswordChanged,
  requireRole(["IT_STAFF", "ADMINISTRATOR"]),
  listAssignableOwnersHandler,
);

// Ownership claim/reassign: IT Staff / Administrator only; state-changing -> CSRF (api-spec §17).
router.post(
  "/staff/tickets/:ticketNumber/owner",
  requireAuth,
  requirePasswordChanged,
  requireCsrf,
  requireRole(["IT_STAFF", "ADMINISTRATOR"]),
  setOwnerHandler,
);

// IT Priority: IT Staff / Administrator only; state-changing -> CSRF (api-spec §18).
router.patch(
  "/staff/tickets/:ticketNumber/priority",
  requireAuth,
  requirePasswordChanged,
  requireCsrf,
  requireRole(["IT_STAFF", "ADMINISTRATOR"]),
  setItPriorityHandler,
);

// Status transition: IT Staff / Administrator only; state-changing -> CSRF (api-spec §19).
router.patch(
  "/staff/tickets/:ticketNumber/status",
  requireAuth,
  requirePasswordChanged,
  requireCsrf,
  requireRole(["IT_STAFF", "ADMINISTRATOR"]),
  applyStatusTransitionHandler,
);

// Public Comments: owner Requester OR IT Staff/Administrator (api-spec §20/§21, §6 matrix).
// POST is state-changing -> CSRF; GET is a read.
router.post(
  "/tickets/:ticketNumber/comments",
  requireAuth,
  requirePasswordChanged,
  requireCsrf,
  requireTicketReadAccess,
  createCommentHandler,
);
router.get(
  "/tickets/:ticketNumber/comments",
  requireAuth,
  requirePasswordChanged,
  requireTicketReadAccess,
  listCommentsHandler,
);

// Internal Notes: IT Staff / Administrator only (api-spec §22/§23). POST -> CSRF.
router.post(
  "/staff/tickets/:ticketNumber/notes",
  requireAuth,
  requirePasswordChanged,
  requireCsrf,
  requireRole(["IT_STAFF", "ADMINISTRATOR"]),
  createNoteHandler,
);
router.get(
  "/staff/tickets/:ticketNumber/notes",
  requireAuth,
  requirePasswordChanged,
  requireRole(["IT_STAFF", "ADMINISTRATOR"]),
  listNotesHandler,
);

// Requester "Problem Appears Resolved": owner Requester only; state-changing -> CSRF (api-spec §20a).
router.post(
  "/tickets/:ticketNumber/appears-resolved",
  requireAuth,
  requirePasswordChanged,
  requireCsrf,
  requireRole(["REQUESTER"]),
  requireTicketOwnership,
  setAppearsResolvedHandler,
);

// ---- Administrator user management (Issue #41) ----
router.get("/admin/users", requireAuth, requirePasswordChanged, requireRole(["ADMINISTRATOR"]), listUsersHandler);
router.post("/admin/users", requireAuth, requirePasswordChanged, requireCsrf, requireRole(["ADMINISTRATOR"]), createUserHandler);
router.patch("/admin/users/:userId", requireAuth, requirePasswordChanged, requireCsrf, requireRole(["ADMINISTRATOR"]), updateUserHandler);
router.post("/admin/users/:userId/initial-password", requireAuth, requirePasswordChanged, requireCsrf, requireRole(["ADMINISTRATOR"]), setInitialPasswordHandler);
