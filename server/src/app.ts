import express from "express";
import cors from "cors";
import { router } from "./module.js";

// The Express app is exported separately from app.listen() (see index.ts) so
// Supertest can import `app` without opening a port. Do not merge these files.
export const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN ?? "http://localhost:5173" })); // allow local dev by default
app.use(express.json());
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
