import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Issue #38 — single shared transition module (frozen Revision 7 Option B).
//
// The canonical module lives at `server/src/ticket-status.ts` (inside the server
// project root, so the server build's inferred `rootDir` and emitted `dist/`
// layout are unchanged). The client consumes that exact source through an
// ABSOLUTE alias. Because this repo has no `workspaces` field, Vite's dev server
// does not treat the repo root as the client's allowed root, so `server.fs.allow`
// must explicitly permit the resolved `server/src` directory — otherwise the
// module is blocked with a `/@fs/` 403 in dev.
const serverSrc = path.resolve(__dirname, "..", "server", "src");

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: "@shared/ticket-status",
        replacement: path.resolve(serverSrc, "ticket-status.ts"),
      },
    ],
  },
  server: {
    fs: {
      allow: [path.resolve(__dirname), serverSrc],
    },
  },
});
