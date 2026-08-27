import { defineConfig } from "vitest/config";
import dotenv from "dotenv";

dotenv.config();

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Integration tests share a single mutable database (TicketSequence years,
    // ticket counts, seed data). Running test files serially avoids cross-file
    // races (e.g. one file exhausting the current-year sequence while another
    // file is creating tickets, or afterAll cleanup mutating another file's
    // before/after counts).
    fileParallelism: false,
  },
});
