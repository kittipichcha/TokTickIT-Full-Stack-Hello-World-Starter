import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import { router } from "./module.js";
import { isActiveDevRequester } from "./service.js";

// The Express app is exported separately from app.listen() (see index.ts) so
// Supertest can import `app` without opening a port. Do not merge these files.
export const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN ?? "http://localhost:5173" })); // allow local dev by default
app.use(express.json());

export function requireDevRequesterContext(
	req: Request,
	res: Response,
	next: NextFunction,
): void {
	const values = req.headers["x-dev-requester-id"];
	const headerValues = Array.isArray(values) ? values : values ? [values] : [];
	const value = headerValues[0];
	const validFormat = typeof value === "string" && /^(?:[1-9][0-9]*)$/.test(value);

	if (headerValues.length !== 1 || !validFormat) {
		res.status(422).json({
			error: { code: "REQUESTER_CONTEXT_INVALID", message: "A valid active requester is required." },
		});
		return;
	}

	isActiveDevRequester(Number(value))
		.then((active) => {
			if (!active) {
				res.status(422).json({
					error: { code: "REQUESTER_CONTEXT_INVALID", message: "A valid active requester is required." },
				});
				return;
			}
			next();
		})
		.catch(() => {
			res.status(500).json({
				error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." },
			});
		});
}

// Mount API routes
app.use("/api", router);

export default app;
