# AGENTS.md

Canonical contract for any coding agent that clones this repo and opens a PR. Vendor files (`.cursor/rules/`, `CLAUDE.md`, Copilot instructions) must **mirror** this file — do not put rules in only one vendor folder.

## Required reading

| Doc | Why |
|---|---|
| [`CONTEXT.md`](./CONTEXT.md) | Short orientation and current scaffold state |
| [`docs/architecture.md`](./docs/architecture.md) | Module seams, autonomy map, work-packet shape |
| [`docs/invariants.md`](./docs/invariants.md) | Locked rules. Do not invent defaults for §18 gaps |
| [`docs/stack.md`](./docs/stack.md) | TypeScript, Fastify, Drizzle, Postgres, Better Auth, Next.js |
| [`docs/api-contract.md`](./docs/api-contract.md) | OpenAPI, Orval, tables vs shop vs ops |

Also obey: [`docs/tax.md`](./docs/tax.md), [`docs/licensing.md`](./docs/licensing.md), [`docs/operator-bridge.md`](./docs/operator-bridge.md), [`docs/observability.md`](./docs/observability.md), [`docs/linear.md`](./docs/linear.md).

## Stack (do not replace)

- **Language:** TypeScript, `strict: true` (see `tsconfig.base.json`); **Node >=24**
- **Monorepo:** pnpm workspaces — `apps/*` + `packages/*`
- **Tests:** Vitest; every use case must run with in-memory adapters (no Docker, no network)
- **API:** Fastify composition root in `apps/api` (stub routes + OpenAPI export)
- **UI:** three Next.js apps later (`internal`, `wholesale`, `ops`) — presentation only
- **DB:** PostgreSQL + Drizzle. Rejected: Prisma-as-only-layer, Nest, GraphQL, tRPC, Mongo, Redis in v1

## Commands (run verbatim)

| Script | Purpose |
|---|---|
| `pnpm test` | Vitest |
| `pnpm lint` | Typecheck (`tsc --noEmit` plus API, shared-kernel, and client packages) |
| `pnpm db:migrate` | Drizzle Kit migrate in `apps/api` only |
| `pnpm dev:api` | API dev server (`apps/api`) |
| `pnpm dev:wholesale` | Wholesale shop (`apps/wholesale`) |
| `pnpm gen:api` | Export OpenAPI YAML + Orval clients |

## Hard rules

1. **Dependency rule:** `domain/` and `application/` import only domain or `packages/shared-kernel`. No Fastify, Drizzle, Zod, Better Auth, Stripe, tax SDKs, Sentry, or logger SDKs on entities or use cases.
2. **Controllers** parse the request, call **one** use case, map the response. No business logic, no SQL.
3. **Inventory** is the only writer of quantities. Never store or mutate `available` as source of truth — movements only.
4. **Frontends** use Orval hooks only — no hand-written API `fetch`.
5. **Tax:** never `price * rate`. Quote/commit via `ITaxCalculator`. Fail closed if the engine is down.
6. **Licensing** owns software subscription money and `IFeatures`. Do not mix into Accounting AR.
7. **Do not implement** the operator platform in this repo. `IOperatorPlatform` is fail-soft.
8. **Do not add** Redis, Prisma, Mongo, GraphQL, tRPC, Nest, Kafka, Datadog, LaunchDarkly-as-required-SDK, or a tax SDK outside `packages/tax/adapters`.
9. **Linear:** all projects, issues, and sub-initiatives belong on the [DC Inventory initiative](https://linear.app/adamhinckley/initiative/dc-inventory-41579ab5d46f/overview).
10. **One agent, one context, one branch.** Stop when the ticket’s tests are green. Do not expand scope.
11. **Acronyms in prose.** In anything a human reads (chat, Linear, specs, docs, PR text), every acronym includes its expansion in parentheses on every use: `MP (member price)`. Do not expand inside code, paths, column names, or type identifiers.

## Work packets

Tickets should look like:

```
Context: <catalog|customers|identity|inventory|…>
Allowed paths: …
Forbidden: …

Given: port + use case + failing unit tests
Do: adapters / HTTP / UI wiring; keep application/ importing only domain/; tests green
```

If asked to invent ledger math, authz matrices, AR rules, tax rates, software-billing/flag catalogs, or operator-platform message kinds without failing tests already in the repo — **stop and ask the owner**.
