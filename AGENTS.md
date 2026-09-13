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

Also obey: [`docs/tax.md`](./docs/tax.md), [`docs/customers.md`](./docs/customers.md), [`docs/accounting.md`](./docs/accounting.md) (AR: customer-level payments, unapplied credit, adjustments, derived status/aging; no GL), [`docs/licensing.md`](./docs/licensing.md), [`docs/operator-bridge.md`](./docs/operator-bridge.md), [`docs/observability.md`](./docs/observability.md), [`docs/linear.md`](./docs/linear.md), [`docs/adr/0007-organization-id-current-not-deferred.md`](./docs/adr/0007-organization-id-current-not-deferred.md) (multi-org seam — current, not deferred; demo stays `DEFAULT`), [`docs/adr/0008-available-to-sell-open-locked.md`](./docs/adr/0008-available-to-sell-open-locked.md) (David's available-to-sell formula; per-SKU open/locked), [`docs/adr/0009-shopify-channel-hub.md`](./docs/adr/0009-shopify-channel-hub.md) (Shopify hub after ATP; native Faire API deferred), [`docs/work-dashboard-design-spec.md`](./docs/work-dashboard-design-spec.md) §12 (internal Input/Select/Combobox/Button: one control height, FieldRow, readable row actions, Button labels Title Case + bold; table-page actions include a leading icon; find/lookup fields are compact `w-52`, not full width) and §13 (tooltip/popover/menu/dialog cards use opaque `.overlay`, not Carbon `$overlay` / `bg-backdrop`).

**Tests and review:** read [`CODING_STANDARDS.md`](./CODING_STANDARDS.md) first when writing tests or reviewing code.

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
| `pnpm dev:api` | API dev server (`apps/api`) — owner runs this; agents do not |
| `pnpm dev:internal` | Staff dashboard (`apps/internal`, :3000) — owner runs this; agents do not |
| `pnpm dev:wholesale` | Wholesale shop (`apps/wholesale`) — owner runs this; agents do not |
| `pnpm gen:api` | Export OpenAPI YAML + Orval clients |

## Hard rules

1. **Dependency rule:** `domain/` and `application/` import only domain or `packages/shared-kernel`. No Fastify, Drizzle, Zod, Better Auth, Stripe, tax SDKs, Sentry, or logger SDKs on entities or use cases.
2. **Controllers** parse the request, call **one** use case, map the response. No business logic, no SQL.
3. **Inventory** is the only writer of quantities. Never store or mutate `available` or `availableToSell` as source of truth — movements only. Do not conflate warehouse leftover (`available`) with sellability (`availableToSell`).
4. **Frontends** use Orval hooks only — no hand-written API `fetch`.
5. **Tax:** this company does not collect sales tax. Do not add `ITaxCalculator`, quote/commit, or tax lines on invoices.
6. **Licensing** owns software subscription money and `IFeatures`. Do not mix into Accounting AR.
7. **Do not implement** the operator platform in this repo. `IOperatorPlatform` is fail-soft.
8. **Do not add** Redis, Prisma, Mongo, GraphQL (as this product’s API), tRPC, Nest, Kafka, Datadog, LaunchDarkly-as-required-SDK, or a tax SDK. Shopify Admin GraphQL is outbound-only when [Shopify channel](https://linear.app/adamhinckley/project/shopify-channel-86c419ea2311) packets open.
9. **Linear:** all projects, issues, and sub-initiatives belong on the [DC Inventory initiative](https://linear.app/adamhinckley/initiative/dc-inventory-41579ab5d46f/overview).
10. **One agent, one context, one branch.** Stop when the ticket’s tests are green. Do not expand scope.
11. **Do not start long-running servers.** Never run `pnpm dev:api`, `pnpm dev:internal`, `pnpm dev:wholesale`, `next dev`, `next start`, or equivalent (foreground or background). Do not `docker compose up` as a watch. If a server is required, tell the owner the exact commands and ports; they start it. One-shot `pnpm test`, `pnpm lint`, `pnpm db:migrate`, and `pnpm gen:api` are allowed.

## Adapter SQL and Orval envelopes

Prevent the [PR #303](https://github.com/adamhinckley/dc-inventory/pull/303) class of breaks (Postgres `uuid = text` 500, then an infinite spinner because Orval `customFetch` does not throw). Mirror in [`.cursor/rules/orval-sql-house-rules.mdc`](./.cursor/rules/orval-sql-house-rules.mdc). CI greps: `scripts/ci-house-rules.sh`.

- **PGlite-test** every new raw SQL adapter path (`VALUES` / `UNION` / branded uuid binds). In-memory use-case tests do not count.
- **Cast uuid** (and other non-text) binds in SQL fragments. Prefer `eq(column, brandedId)` when Drizzle can type it. Raw `` sql`${brandedId}` `` is text.
- Treat SQL rewrites (OR→VALUES, listAll→filtered SQL) as **new queries** — re-test the SQL, do not rely on the old in-memory suite.
- **Staff tables:** take `busy` / `listFailed` from `useDataTable` or use `DataTable.Root`. Ban hand-rolled `envelope === undefined && query.isError !== true`.
- **Success = `isSuccessfulOrvalResponse` / status 2xx.** `customFetch` returns `{ data, status, headers }` and does not throw on HTTP 500. Do not key loading on `!query.isError` alone.

## Work packets

Implementation tickets (not grilling/map decisions) must be this shape **before** `ready-for-agent`. All five fields written, not implied:

```
Context: <catalog|customers|identity|inventory|shopify-bridge|…>
Allowed paths: …
Forbidden: …

Given:
- <port / use case / test / fixture — file or symbol names>

Do:
- …
- Run the tests for this context; stop when green
```

**Given** names what exists. One repo pass: cite the list/table/HTTP/CSV/adapter to follow, or write `none exists`. Do not sketch a second table stack, CSV dialect, or HTTP resource beside a working one.

**Done** is observable: tests green for this context, a named route, or a named screen shows X. "Implement X" is not Done. OpenAPI changes include `pnpm gen:api`.

If another ticket produces this packet's Given, Linear-block it. Do not write "can start immediately" when the port, flag, or HTTP is still missing. If two tickets share a use case, name which issue owns the use case and which owns HTTP/UI.

If asked to invent ledger math, authz matrices, AR rules, sales tax, software-billing/flag catalogs, or operator-platform message kinds without failing tests already in the repo — **stop and ask the owner**.

## Agent skills

Per-repo wiring for Matt Pocock engineering skills. Skills live under [`.agents/skills/`](./.agents/skills/) and are locked in [`skills-lock.json`](./skills-lock.json).

| Skill | Role |
|---|---|
| `setup-matt-pocock-skills` | One-time tracker / domain wiring (already applied below) |
| `wayfinder` | Multi-session decision map on Linear |
| `grilling` | HITL interview primitive (wayfinder default ticket) |
| `domain-modeling` | Glossary / ADR sharpening (always with grilling) |
| `research` | AFK fact-finding subagent (wayfinder research tickets) |
| `prototype` | HITL throwaway artifact (wayfinder prototype tickets) |
| `handoff` | Compact a session into / out of a wayfinder map |
| `to-spec` | Collapse a cleared map into one spec |
| `to-tickets` | Slice a spec into tracer-bullet implementation tickets |
| `improve-codebase-architecture` | Periodic deepening survey (HTML report; no code edits) |
| `unslop` | Strip AI tells from writing |
| `recall` | Rebuild recent working context from chat history + shared record before starting/resuming |
| `why` | Shared-record investigation (used by `recall` for feature/bug history across tracker/chat/docs) |

### Issue tracker

Linear on the [DC Inventory initiative](https://linear.app/adamhinckley/initiative/dc-inventory-41579ab5d46f/overview). See [`docs/agents/issue-tracker.md`](./docs/agents/issue-tracker.md) (includes **Wayfinding operations** for `/wayfinder`).

### Domain docs

Single-context: root [`CONTEXT.md`](./CONTEXT.md) + [`docs/adr/`](./docs/adr/). See [`docs/agents/domain.md`](./docs/agents/domain.md).
