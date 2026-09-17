import express from "express";
import cors from "cors";
import { router } from "./module.js";
import { sessionMiddleware } from "./session.js";

// The Express app is exported separately from app.listen() (see index.ts) so
// Supertest can import `app` without opening a port. Do not merge these files.
export const app = express();

// CORS (frozen §13 / review Rev5 §5.7): credentials + explicit origin + exposed CSRF header.
app.use(
  cors({
    origin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
    credentials: true,
    exposedHeaders: ["X-CSRF-Token"],
  }),
);

// Session middleware (httpOnly cookie + server-side store; frozen §13).
app.use(sessionMiddleware());

// Capture raw body for integer lexical validation (api-spec §0: integer grammar)
// Stored per-request on req to avoid concurrency issues.
app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as unknown as Record<string, unknown>).rawBody = buf.toString("utf-8");
    },
  }),
);

// Mount API routes
app.use("/api", router);

// Canonical error handling for JSON parsing failures
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ): void => {
    if (
      err instanceof SyntaxError &&
      "body" in err &&
      (err as Record<string, unknown>).type === "entity.parse.failed"
    ) {
      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Request body must be valid JSON.",
          fields: {},
        },
      });
      return;
    }
    next(err);
  },
);

export default app;
