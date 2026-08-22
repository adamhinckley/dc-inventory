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

`buildApp({ clock, features, database, logger })` is how tests swap adapters (e.g. `InMemoryClock`, `InMemoryDatabase`). Production uses `SystemClock`, `PostgresDatabase`, and `featuresAllCoreOn()`.

## Local Postgres

From the **repo root**, start Compose (Postgres 16 + MinIO placeholders), copy env examples, migrate, then boot the API:

```bash
docker compose up -d --wait
cp .env.example .env
cp apps/api/.env.example apps/api/.env
pnpm db:migrate
pnpm dev:api
```

`pnpm db:migrate` is the only migrate entrypoint. It runs `drizzle-kit migrate` in this app. There is no `packages/db` and no second Kit config.

The API **will not listen** without `DATABASE_URL`. Missing or blank values throw `MissingDatabaseUrlError` with a message that points here. `pnpm dev:api` loads `apps/api/.env` if `DATABASE_URL` is not already in the environment.

Or export it yourself:

```bash
export DATABASE_URL=postgres://postgres:postgres@localhost:5432/dc_inventory
pnpm dev:api
```

- `GET /health` never opens a connection (uptime monitors use this).
- `GET /ready` runs `SELECT 1` on the same postgres.js client Drizzle uses. `200 { "ready": true }` or `503 { "ready": false, "error": "…" }`. `/ready` does **not** migrate (OP5).
- There are **no business tables** yet. [`src/infrastructure/schema.ts`](./src/infrastructure/schema.ts) is empty; [`drizzle/migrations`](./drizzle/migrations) is an empty Kit journal for later context tickets. Do not add Catalog/Inventory schemas here.
- MinIO is in Compose so object storage is in the box. Do not wire `IFileStorage`.

Unit tests inject `InMemoryDatabase`. They do not start Docker, open a network socket, or run migrate.

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
