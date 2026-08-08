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
| 6 | Issue 2: Implement the API health check
Type: Feature
Required branch: feature/2-health-check
Acceptance criteria:
· GET /api/health returns HTTP 200.
· The JSON response contains status = ok and service = TokTickIT API.
· A Supertest test verifies the endpoint.
· The React page displays the backend status based on a real API call.
· A useful error message appears when the backend is unavailable. following this criteria, can you write a code and explain it to me | I read the code file and try to understand what's happening |
| 7 | Can you make it check the real connection to the database and explain what you will do, and how to test it | I read the explaination and accept the code |
## Reflection
1. There's a few moment when I feel tired and blindly accept every change which make the problem worse, in context I have a few experience related to worktree however it look like agent doesn't understand my instruction and make the worktree so confusing.
2. Agent need to provide context (project structure and overview) and prompt clearly to make it understand the project structure and tell you clearly
3. This model is not sufficient enough to work alone without human intervention.
