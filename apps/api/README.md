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
- `GET /ready` — readiness stub (will ping Postgres in ADA-34)
- `GET /ping` — golden-path HTTP adapter over `PingUseCase`

Structured JSON logs go to stdout (Pino). Every response includes `x-request-id`; incoming `x-request-id` is reused and appears on log lines as `requestId`.

## Where DI lives

Composition is explicit — no Nest-style container.

| What | Where |
|---|---|
| Wire ports → adapters | [`src/infrastructure/composition.ts`](./src/infrastructure/composition.ts) (`composeAppServices`) |
| Build the Fastify instance | [`src/app.ts`](./src/app.ts) (`buildApp`) |
| Process listen | [`src/server.ts`](./src/server.ts) |
| Pino JSON + redaction | [`src/infrastructure/logging.ts`](./src/infrastructure/logging.ts) |
| `requestId` / `x-request-id` | [`src/infrastructure/request-id.ts`](./src/infrastructure/request-id.ts) |

`buildApp({ clock, features, logger })` is how tests swap adapters (e.g. `InMemoryClock`). Production uses `SystemClock` and `featuresAllCoreOn()`.

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
