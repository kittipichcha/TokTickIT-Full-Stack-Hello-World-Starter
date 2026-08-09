# Lab 1 — AI Use and Reflection  (fill this in)

**LLM/agent used:** <github copilot (claude haiku 4.5)>

## Selected key prompts (6–10)
| # | Prompt (summarised) | What I did with the result |
|---|---------------------|----------------------------|
| 1 |  Check dependencies collision and version for this project | I read the suggestion and saw volunerbility warning which it suggest to update the package with `npm audit fix --force` |
| 2 |  Should I commit package-lock.json | It say it need for compatibility accross team and I believe it |
| 3 |  can you explain how frontend code work, how it connect with each other and lastly how config and main connect to each other | It has suggest how each flow work and I try to understand it |
| 4 | fix this fix this te.config.ts 
error during build:
Error: config must export or return an object. | It has found out that config file in frontend did not return any value cause the error and suggest the fix |
| 5 | Error: P1013: The provided database string is invalid. invalid port number in database URL. Please refer to the documentation in | It explain that this cause by wrong postgres server link (wrong password and db name) I used to have in .env file then I let it correct it which make it functional again.
| 6 | Issue 2: Implement the API health check<br/>Type: Feature<br/>Required branch: feature/2-health-check<br/>Acceptance criteria:<br/>• GET /api/health returns HTTP 200.<br/>• The JSON response contains status = ok and service = TokTickIT API.<br/>• A Supertest test verifies the endpoint.<br/>• The React page displays the backend status based on a real API call.<br/>• A useful error message appears when the backend is unavailable. | I read the code file and try to understand what's happening |
| 7 | Can you make it check the real connection to the database and explain what you will do, and how to test it | I read the explaination and accept the code |
| 8 | Can you tell me what I need to do to pass the criteria for category seed? (Prisma model, migration, seed) | The agent explained: Prisma model defines the Category table schema, migration creates it in the database, and seed populates it with initial data. I learned that upsert() prevents duplicates when running seed multiple times. |
| 9 | Can you apply the changes to 3-category-seed? Tell me how to test and update docs. | The agent implemented the Category model in schema.prisma, wrote the seed.ts script using upsert() for idempotency, created migrations, and documented all test steps and acceptance criteria. |
| 10 | Create copilot customization files for CPE334: 13 rules, multi-perspective planning agent (1 agent + 3 instructions). Focus on documentation, testing, clarity, and approval gates. | I created 5 markdown customization files in `.github/` folder: copilot-instructions.md (core rules), planning-agent.agent.md (main agent), normal/contradicted/arbitrator-perspective.instructions.md (3 perspectives). These enforce Rule 1-4, 7-13 and enable Rule 5-6 multi-perspective planning. |
| 11 | Feature: Implement category list (GET /api/categories)<br/>Requirements:<br/>• Backend: Service function queries all categories from PostgreSQL via Prisma, sorted by ID ascending<br/>• Controller: GET /api/categories handler returning JSON array<br/>• Frontend: React component with "Load Categories" button, loading/error states<br/>• Tests: Supertest integration test + Vitest unit test + React component test | I reviewed the requirements and approved the implementation plan. The agent then implemented: (1) Service layer with getCategories() using Prisma orderBy, (2) Controller handler with error handling, (3) Updated module.ts routes, (4) api.ts with fetchCategories() function, (5) App.tsx with category UI section with loading/error states, (6) Backend integration + unit tests for categories endpoint, (7) Frontend React component test with mocked API. All code follows existing patterns and TypeScript conventions. |

## Reflection
1. There's a few moment when I feel tired and blindly accept every change which make the problem worse, in context I have a few experience related to worktree however it look like agent doesn't understand my instruction and make the worktree so confusing.
2. Agent need to provide context (project structure and overview) and prompt clearly to make it understand the project structure and tell you clearly
3. This model is not sufficient enough to work alone without human intervention.
