# .env.example vs DATABASE_URL docs only

**Ticket:** [`.env.example` vs DATABASE_URL docs only](https://linear.app/adamhinckley/issue/ADA-48/envexample-vs-database-url-docs-only)
**Kind:** grilling (demo-only lock for the Phase 0 spec)
**Map:** [Phase 0 implementation spec map](https://linear.app/adamhinckley/issue/ADA-41/phase-0-implementation-spec-map)
**HITL:** Cursor thread [bc-411f69b0](https://www.cursor.com/agents/bc-411f69b0-60a8-4e58-be6f-77e3bdfb3048) (Q1 open — answer in chat)
**Not product law:** do not edit [`invariants.md`](../../invariants.md) §18 or tick [`open-questions.md`](../../open-questions.md)

This note does not add compose, MinIO wiring, or real secrets.

Do **not** treat a Done comment that appears before HITL as canonical.

---

## HITL

| Q | Pick | Lock |
| --- | --- | --- |
| 1 Where env lives | *waiting* | Committed `.env.example` + compose env, or docs-only `DATABASE_URL` |

---

## Already locked (not this question)

| Lock | Source |
| --- | --- |
| Never commit real `.env` values. | [`invariants.md`](../../invariants.md) OP8 |
| Compose includes MinIO. Do **not** wire `IFileStorage` in Phase 0. | [Phase 0 implementation spec map](https://linear.app/adamhinckley/issue/ADA-41/phase-0-implementation-spec-map) |
| Required CI: Compose + `pnpm db:migrate` + `GET /ready`. `pnpm test` stays in-memory. | [CI migrate vs local-only stop condition](https://linear.app/adamhinckley/issue/ADA-49/ci-migrate-vs-local-only-stop-condition) |
| API already has `apps/api/.env.example` (`DATABASE_URL`, `PORT`). `.env` / `.env.*` are gitignored except `!.env.example`. Wholesale/internal have their own shop/API-proxy examples. | tree on `main` |

`docs/demo-assumptions.md` does **not** exist yet. A later `/to-spec` agent writes it. This ticket only decides whether Phase 0 **must** keep/require committed example env files (and compose service env), or whether naming `DATABASE_URL` in the spec / that doc is enough.

---

## Q1 — Example files, or docs only?

Reply in the Cursor thread with **1**, **2**, or **3**.

### 1 — Require committed examples + compose env

Phase 0 must keep (and, if missing, add) committed `.env.example` files and Compose `environment` for Postgres + MinIO. Values are **placeholders only** (`postgres`/`postgres`, local MinIO keys). Never commit a real `.env`.

**Pro:** An agent or you can `cp .env.example .env` and match CI. Compose and the API share the same dummy names.

**Con:** More files to keep in sync. Easy to later paste a real secret into an example. MinIO keys in git even though the API does not use them yet.

### 2 — Docs only

The spec (and later `docs/demo-assumptions.md`) names `DATABASE_URL`. No Phase 0 requirement to keep or add `.env.example`. Compose can still set service env in YAML.

**Pro:** One place to read. Less “which file is truth.” Secrets stay out of git by default.

**Con:** Agents already copy `apps/api/.env.example`. Dropping the requirement can drift the existing file or confuse CI vs laptop. You have to remember the URL from a markdown page.

### 3 — Keep today’s API example; compose holds service env; no app MinIO keys

Keep `apps/api/.env.example` as the API contract (`DATABASE_URL` + `PORT`). Compose YAML holds Postgres + MinIO **container** env. Do **not** add API/app `S3_*` / MinIO keys until `IFileStorage` is wired. Do **not** require a new root `.env.example`. Wholesale/internal examples stay as they are (not this ticket).

**Pro:** Matches the scaffold. CI can inject `DATABASE_URL` from Compose without new files. MinIO stays a box in Compose, not a fake storage SDK.

**Con:** Two places (example file + compose YAML). Docs still have to say “copy the API example.”

---

## What this does not decide

- Writing `docs/demo-assumptions.md`, compose, or migrations (after `/to-spec`)
- Wiring `IFileStorage` or catalog image upload
- Neon / production secrets
- Changing OP8
