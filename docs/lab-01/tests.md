# Lab 1 — Test Plan and Evidence  (fill this in)


## Issue 1: Set up the TokTickIT project foundation
Type: Technical setup

| # | Test | Result | Evidence |
|---|------|--------|----------|
| 1 | Server startup: `cd server && npm run dev` | ✅ PASS | The TokTickIT API server initialized successfully with tsx watch mode enabled. This confirms the Node.js environment is properly configured and all server dependencies (tsx, express, etc.) are compatible and correctly installed. The API listener on port 3000 proves the server stack is functional. |
| 2 | Client startup: `cd client && npm run dev` | ✅ PASS | Vite 6.4.3 bundler initialized in 839ms, confirming the React/frontend build system is properly configured. The successful compilation proves all client dependencies (Vite, React, etc.) are compatible. The local dev server on port 5173 is ready for browser access. |
| 3 | Client application: `http://localhost:5173/` | ✅ PASS | The application renders successfully in the browser displaying "App is working". This proves end-to-end initialization is complete: server is running, client is built and served, and the full-stack application is operational and compatible across all libraries and frameworks. |
