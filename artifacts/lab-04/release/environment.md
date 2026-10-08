# Issue #55 verification environment

Recorded 2026-10-07; continued 2026-10-08, Asia/Bangkok. Checkout began clean at `ed91b191ed44c3cb71de1ae61484f91e32b98e28` from remote `lab4-staging`; active branch is `feature/lab4-integration-release`. Source changes remain a working diff during verification; `executable-fingerprints.json` records the actual executable and lockfile bytes, rather than claiming HEAD alone describes them.

| Tool / environment | Actual value |
| --- | --- |
| OS | Windows `10.0.26200`, `win32` |
| CPU | AMD Ryzen 7 5700U with Radeon Graphics; 16 logical CPUs |
| RAM | 16,469,520,384 bytes |
| Node / npm | 24.14.0 / 11.9.0 |
| PostgreSQL CLI, dump, restore | 18.1 |
| Prisma client | 5.22.0 |
| Playwright | 1.62.1 |
| Actual Chromium | 151.0.7922.34; owned launch/version/close recorded in `browser-version.json` |
| Vitest | 4.1.10 |
| Vite | 6.4.3 |

Lockfile SHA-256 values:

| Lock | SHA-256 |
| --- | --- |
| root | `ad0291329974ce92162607948d9b54a5ecfecff8ddb20a78d5414e620c416225` |
| server | `cf4206ed9554080365638fd1c5697d6bc8ae0d838051ef139340a0b5386edad6` |
| client | `3e4083c383eeb2ab9369e747d4ac80cdea270d556f450376549fb384ffb52eeb` |

`npm ci --cache C:/Users/kitti/CPE334/.npm-cache` completed from root (3 packages), server (229), and client (170), preserving the existing locks. Root reported zero audit vulnerabilities; server reported ten (5 moderate, 4 high, 1 critical). No dependency upgrades were introduced. These installation results were captured in the orchestration tool transcript, not invented standalone log files.

Private environment configuration is outside the Git worktree. It derives credentials from the previous ignored local fixture configuration, rejects non-loopback hosts, and selects separate disposable databases named `lab4_release_issue55_{test,browser,rehearsal}_20261007`. URLs and secrets are not committed. The browser and backend databases each received all eight existing migrations through `npx prisma migrate deploy`. The browser DB was seeded before verification; a first interrupted backend attempt omitted its initial seed, so the required backend fixture seed completed before the full 2026-10-08 rerun (`backend-seed.log`). The full backend runner uses additional self-created disposable historical/migration/performance fixtures. Normal Prisma generation completed after old processes released the Windows DLL; `staging/rehearsal/generate-retry.txt` records exit 0 and Prisma Client 5.22.0.

Final backend verification uses the additional pristine `lab4_release_issue55_fresh_20261007` database, created and seeded on 2026-10-08 before fixtures. It verified Ada ID 1, four active categories and six active related systems. The earlier used test database retained pre-seed fixture IDs and is kept only for diagnostic provenance; its failed completed run does not certify release.

The Windows sandbox denied localhost sockets, npm DNS and some Vite realpath operations; on continuation its process setup also failed. Authorized verification commands therefore used the approved execution environment. These failed environment attempts are distinct from test assertions. Both `npm run build` commands completed successfully after using that environment: server TypeScript build and client TypeScript/Vite production bundle (52 modules). The latest standalone build logs include precise UTC start/end/exit manifests.

No normal application run uses the historical schema override. Its test-only contexts are confined to disposable migration fixtures. No ninth migration, production database mutation, lockfile update, or external deployment occurred.
