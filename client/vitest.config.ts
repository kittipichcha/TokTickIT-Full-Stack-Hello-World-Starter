import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

// Issue #38 — the shared transition module lives at `server/src/ticket-status.ts`
// and is consumed by the client through the same absolute alias the Vite build
// uses. The test runner needs the identical mapping so component tests resolve it.
const serverSrc = path.resolve(__dirname, "..", "server", "src");

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    css: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@shared/ticket-status": path.resolve(serverSrc, "ticket-status.ts"),
    },
  },
});
