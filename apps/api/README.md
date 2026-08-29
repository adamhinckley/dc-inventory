# `@dc-inventory/api`

Fastify 5 composition root for DC Inventory. One process serves `/internal`, `/wholesale`, and `/ops`. Domain packages never import this app — this folder **wires** ports to adapters.

## How to run

From the **repo root** (the script agents and CI use):

```bash
pnpm dev:api
```

Same thing from this package: `pnpm --filter @dc-inventory/api dev`.

- Default bind: `0.0.0.0:3001` (`PORT` overrides the port)
- `GET /health` — liveness (no database)
- `GET /ready` — readiness (`SELECT 1` via Drizzle / postgres.js)
- `GET /ping` — golden-path HTTP adapter over `PingUseCase`

Structured JSON logs go to stdout (Pino). Every response includes `x-request-id`; incoming `x-request-id` is reused and appears on log lines as `requestId`.

## Where DI lives

Composition is explicit — no Nest-style container.

| What | Where |
|---|---|
| Wire ports → adapters | [`src/infrastructure/composition.ts`](./src/infrastructure/composition.ts) (`composeAppServices`) |
| Build the Fastify instance | [`src/app.ts`](./src/app.ts) (`buildApp`) |
| Process listen | [`src/server.ts`](./src/server.ts) |
| `DATABASE_URL` + Postgres client | [`src/infrastructure/database-url.ts`](./src/infrastructure/database-url.ts), [`src/infrastructure/db.ts`](./src/infrastructure/db.ts) |
| Pino JSON + redaction | [`src/infrastructure/logging.ts`](./src/infrastructure/logging.ts) |
| `requestId` / `x-request-id` | [`src/infrastructure/request-id.ts`](./src/infrastructure/request-id.ts) |

`buildApp({ clock, features, database, logger })` is how tests swap adapters (e.g. `InMemoryClock`, `InMemoryDatabase`). Production evaluates `LicensingFeatures` from Postgres. Local `pnpm dev:api` uses `featuresAllCoreOn()` unless `FEATURES_ALL_CORE_ON=0`.

## Local Postgres

From the **repo root**, start Compose (Postgres 18 + MinIO placeholders), copy env examples, migrate, then boot the API:

```bash
docker compose up -d --wait
cp .env.example .env
cp apps/api/.env.example apps/api/.env
pnpm db:migrate
pnpm dev:api
```

`pnpm db:migrate` is the only migrate entrypoint. It runs `drizzle-kit migrate` in this app. There is no `packages/db` and no second Kit config.

The API **will not listen** without a Postgres URL. Missing or blank values throw `MissingDatabaseUrlError` with a message that points here. `pnpm dev:api` loads `apps/api/.env` without overwriting variables already in the environment. Core feature flags stay on for that local listen so demo seed can leave `licensing` empty. Set `FEATURES_ALL_CORE_ON=0` to evaluate Postgres subscriptions instead.

To point the same process at Neon instead of Compose, set `DATABASE_TARGET=neon` and put the **direct** (unpooled) connection string in `DATABASE_URL_NEON`. Flip back with `DATABASE_TARGET=local`. `pnpm db:migrate` uses the same resolver. Demo seed still refuses remote hosts. Pull the Neon URL with `npx neon@latest env pull` or Neon MCP `get_connection_string` — do not commit it.

## Fly (public API)

The Next apps stay local or on Vercel. This process is the only thing that talks to Neon. Deploys come from GitHub Actions (`.github/workflows/deploy-api.yml`): push to `main`, or **Actions → Deploy API → Run workflow**. Do not `fly deploy` from a laptop unless Actions is down.

Repo secrets (Settings → Secrets and variables → Actions):

- `FLY_API_TOKEN` — `fly tokens create deploy --app dc-inventory-api`
- `DATABASE_URL` — Neon **direct** (unpooled) URL for `pnpm db:migrate` in CI. Same value as the Fly app secret. Never the `-pooler` host.

The image does not migrate on boot. CI migrates, then `flyctl deploy --remote-only --ha=false`.

`GET /health` is liveness (no Postgres). `GET /ready` is `SELECT 1` against Neon. The Machine stops when idle (`min_machines_running = 0`) so a quiet month stays cheap. First request after sleep waits for a cold start.

First-time app create (once):

```bash
fly apps create dc-inventory-api --org personal
fly secrets set DATABASE_URL='postgresql://…' --app dc-inventory-api
```

Or export it yourself:

```bash
export DATABASE_URL=postgres://postgres:postgres@localhost:5432/dc_inventory
pnpm dev:api
```

- `GET /health` never opens a connection (uptime monitors use this).
- `GET /ready` runs `SELECT 1` on the same postgres.js client Drizzle uses. `200 { "ready": true }` or `503 { "ready": false, "error": "…" }`. `/ready` does **not** migrate (OP5).
- Catalog through operator_bridge tables (including licensing `software_payments` and the fail-soft outbox) live in [`src/infrastructure/schema/`](./src/infrastructure/schema/) and are re-exported from [`src/infrastructure/schema.ts`](./src/infrastructure/schema.ts). Do not create a second migrate home. Do not surface software payments in any UI. `IOperatorPlatform` stays no-op.
- MinIO is in Compose so object storage is in the box. Do not wire `IFileStorage`.

Unit tests inject `InMemoryDatabase`. They do not start Docker, open a network socket, or run migrate. Required CI (`compose-migrate-ready`) is a job step that starts Compose, runs `pnpm db:migrate`, then proves `GET /ready` — migrate is not inside this route.

## Golden path (copy this later)

Ping is **not** a fake Catalog. It exists so later contexts can copy the rings:

```
src/domain/clock.ts          # port (IClock)
src/application/ping.ts      # use case — imports domain only
src/adapters/in-memory-clock.ts
src/adapters/http/ping.ts    # parse → one use case → map response
```

`pnpm test` from the repo root runs the Ping unit test (in-memory clock, no listen) and the composition-root HTTP tests (`inject`, no network).

## Audience mounts

`buildApp` registers Fastify plugins at `/internal`, `/wholesale`, and `/ops`. OpenAPI export (`pnpm gen:api`) builds one swagger app per audience via `buildAudienceApp` so the three specs stay isolated.
