import express from "express";
import cors from "cors";
import { router } from "./module.js";
export { requireDevRequesterContext } from "./requester-context.js";

// The Express app is exported separately from app.listen() (see index.ts) so
// Supertest can import `app` without opening a port. Do not merge these files.
export const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN ?? "http://localhost:5173" })); // allow local dev by default
app.use(express.json());
// Mount API routes
app.use("/api", router);

export default app;
