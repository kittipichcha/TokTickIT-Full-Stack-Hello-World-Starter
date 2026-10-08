# Issue #55 — migration and recovery audit

Reviewed 2026-10-08. No ninth migration or release schema change was introduced. The eight canonical directories are retained:

1. `20260808100141_add_cateogory`
2. `20260823090000_add_dev_requester`
3. `20260823091000_add_is_active_to_category`
4. `20260825000000_add_ticket_related_system_attachment`
5. `20260826000000_add_ticket_indexes_attachment_relations`
6. `20260917000000_lab3_phase_a_expand`
7. `20260917000001_lab3_phase_c_contract`
8. `20261001000000_lab4_actions_foundation`

The historical schema fixture remains byte-identical, SHA-256 `7b5c5aceb173a4198731de90d3492d1f38861943099ea1fc5c2c85f6b31b5070`. README gives separate procedures for empty disposable history deployment, verified populated Lab 3 cutover with seven prerequisites and only the eighth pending, and populated Lab 2 conversion at the pinned Lab 3 release before Lab 4 cutover.

The dedicated empty rehearsal database applied all eight migrations successfully and status reported up to date; raw output is in `staging/rehearsal/empty-migrate.txt` and `migration-status.txt`. Normal-schema explicit Prisma generation retried successfully on 2026-10-08 after the earlier Windows DLL contention failure; the retry manifest records command, cwd, times and exit 0. Seed ran twice on the isolated rehearsal database. These command outcomes do not replace populated preservation assertions.

Canonical `server/tests/lab-04/migration.integration.test.ts` retains DB-MIG-01–03: prerequisite upgrade/preservation, failed deployment before accepted writes with paired restore, and accepted-write forward repair. DB-MIG-04 remains in `server/tests/lab-03/migration.integration.test.ts`, preserving the verified historical fixture, unsafe-override rejection and normal-history status/deploy/status assertions. The failure contract inspects the actual unfinished Prisma record and partial-DDL probe before restoring paired database/files snapshots into another target. It does not assume failed deploy automatically or completely rolls back. The post-write contract preserves accepted data and repairs forward rather than restoring an old snapshot.

Historical issue-51 `migration-recovery.md` now describes that actual observation/restore boundary while preserving historical run provenance. All recovery fixtures are synthetic disposable rehearsals, not a claimed live incident. Private database dumps and attachment snapshots remain outside committed evidence. Final `server-final-results.json` records all three Lab 4 migration cases, all 26 Lab 3 migration cases and all three Lab 4 seed cases passed; `server-final-manifest.json` confirms exit 0 for the pristine seeded database. This supports current DB-MIG-01–04/DB-SEED-01 certification. Earlier incomplete/failed attempts remain separately retained and are not passes.
