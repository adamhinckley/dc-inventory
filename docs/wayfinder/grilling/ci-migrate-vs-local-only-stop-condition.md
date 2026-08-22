# CI migrate vs local-only stop condition

**Ticket:** [CI migrate vs local-only stop condition](https://linear.app/adamhinckley/issue/ADA-49/ci-migrate-vs-local-only-stop-condition)
**Kind:** grilling (demo-only lock for the Phase 0 spec)
**Map:** [Phase 0 implementation spec map](https://linear.app/adamhinckley/issue/ADA-41/phase-0-implementation-spec-map)
**HITL:** Cursor thread [bc-411f69b0](https://www.cursor.com/agents/bc-411f69b0-60a8-4e58-be6f-77e3bdfb3048) (Q1 open — answer in chat, not here)
**Not product law:** do not edit [`invariants.md`](../../invariants.md) §18 or tick [`open-questions.md`](../../open-questions.md)

This note does not add `docker-compose.yml`, Drizzle schemas, migrations, or a GitHub Actions workflow.

Do **not** treat a Done comment that appears before HITL as canonical.

---

## HITL

| Q | Pick | Lock |
| --- | --- | --- |
| 1 Phase 0 stop condition | *waiting* | CI compose + migrate + `/ready`, or local-only while `pnpm test` stays in-memory |

---

## Already locked (not this question)

| Lock | Source |
| --- | --- |
| Use-case tests use in-memory adapters. **No Docker, no network** in `pnpm test`. | `AGENTS.md`, [`stack.md`](../../stack.md) §7 |
| `GET /health` does not touch Postgres. `GET /ready` is `SELECT 1`, **not** migrations. | [`invariants.md`](../../invariants.md) OP5, [`observability.md`](../../observability.md) |
| Phase 0 still **ships** compose (Postgres 16 + MinIO) and `pnpm db:migrate` after the spec exists. Kit stays in `apps/api`. | [Phase 0 implementation spec map](https://linear.app/adamhinckley/issue/ADA-41/phase-0-implementation-spec-map), [Drizzle Kit home and db:migrate](https://linear.app/adamhinckley/issue/ADA-45/drizzle-kit-home-and-dbmigrate) |
| Repo today has no test/migrate CI. Only `.github/workflows/request-copilot-review.yml`. | tree on `main` |

This ticket only decides whether the **spec’s done-when** includes a **CI gate** that boots Compose, runs `pnpm db:migrate`, and fails if `/ready` cannot talk to Postgres.

---

## Q1 — Must CI prove the Postgres loop?

Reply in the Cursor thread with **1**, **2**, or **3**.

### 1 — Required CI gate

The Phase 0 spec says the implementer is **not done** until GitHub Actions (or equivalent) starts Compose, runs `pnpm db:migrate`, boots the API, and fails the job if `GET /ready` cannot talk to Postgres.

**Pro:** A merge cannot land SQL that never ran. Agents get a red X instead of “works on my laptop.”

**Con:** Phase 0 grows a Docker-in-CI job (minutes, Actions minutes, compose/service wiring). The repo has almost no CI today. More moving parts for a local demo.

### 2 — Local-only stop condition

The implementer is done when compose + migrate + `/ready` works **on a laptop**. `pnpm test` stays in-memory. CI migrate is **out of this Phase 0 spec** (can be a later ticket).

**Pro:** Matches “unit tests never start Compose.” Smaller Phase 0. You can still run the loop yourself.

**Con:** A PR can merge migrations nobody ran in CI. You only see a bad SQL file when someone starts Postgres locally.

### 3 — Workflow file, not a required check

Phase 0 **adds** a migrate/ready workflow (or documents the job), but it is **not** a required GitHub check. Local compose + migrate + `/ready` is still the stop condition. `pnpm test` stays in-memory.

**Pro:** The recipe exists in the repo without making every PR wait on Docker.

**Con:** Optional jobs get ignored. You can still merge SQL that never ran. Slightly more files than option 2.

---

## What this does not decide

- [`.env.example` vs DATABASE_URL docs only](https://linear.app/adamhinckley/issue/ADA-48/envexample-vs-database-url-docs-only) (blocked until this ticket closes)
- Writing `docs/demo-assumptions.md`, compose, or migrations (after `/to-spec`)
- Changing OP5 (`/ready` must not run migrations)
- Putting Docker inside `pnpm test`
