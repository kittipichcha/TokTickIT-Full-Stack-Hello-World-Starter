import "dotenv/config";
import { app } from "./app.js";
import { startIdempotencyCleanupScheduler } from "./action-idempotency.js";

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, () => {
  console.log(`TokTickIT API listening on http://localhost:${PORT}`);
  // Hourly Action-create idempotency expiry cleanup (api-spec §12). The timer is
  // unref()-ed, so it never keeps a short-lived process alive.
  startIdempotencyCleanupScheduler();
});
