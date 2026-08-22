# DC Inventory — context

Wholesale inventory control: catalog, stock ledger, purchasing, wholesale shop, customers, thin AR, software licensing.

This file orients agents. The contracts live in `docs/`.

## Start here

1. [`AGENTS.md`](./AGENTS.md) — vendor-neutral repo contract (read first)
2. [`docs/architecture.md`](./docs/architecture.md) — module map, autonomy, work packets
3. [`docs/invariants.md`](./docs/invariants.md) — locked rules (do not invent §18 defaults)
4. [`docs/stack.md`](./docs/stack.md) — TypeScript, Fastify, Drizzle, Postgres, Better Auth, Next.js
5. [`docs/api-contract.md`](./docs/api-contract.md) — OpenAPI, Orval, tables vs shop

Also: [`docs/tax.md`](./docs/tax.md), [`docs/licensing.md`](./docs/licensing.md), [`docs/operator-bridge.md`](./docs/operator-bridge.md), [`docs/observability.md`](./docs/observability.md), [`docs/linear.md`](./docs/linear.md).

## Current scaffold

Root pnpm workspace (`apps/*`, `packages/*`), TypeScript `strict: true`, Vitest, Node >=24, and `packages/shared-kernel` (`Money`, `Sku`, branded IDs). Fastify lives in `apps/api`: composition root + DI in `apps/api/src/infrastructure`, Drizzle + postgres.js (`DATABASE_URL`, no business schemas), `GET /health` (no DB) + `GET /ready` (`SELECT 1`), Pino JSON + `requestId`, Ping golden path, and stub `/internal`, `/wholesale`, and `/ops` mounts. `pnpm gen:api` writes committed OpenAPI YAML and Orval clients (`packages/api-client-*`). `packages/ui` is Tailwind v4 + shadcn-style primitives with Carbon White / g100 tokens and a root Storybook (`pnpm storybook`). `apps/wholesale` is an App Router shop shell (Orval hooks, example product list); Internal and Ops UIs are not in this pass.

## Language

### Products and audiences

**Internal app**:
The staff dashboard (`apps/internal`): tables, reports, charts, and CRUD. Not the wholesale shop.
_Avoid_: Admin app, back office (unless speaking casually), spreadsheet UI as the product name

**Wholesale app**:
The client e-commerce app (`apps/wholesale`): browse, PDP, cart, checkout, order history. Not a `DataTable` product.
_Avoid_: Storefront as a synonym in tickets (prefer Wholesale app), shop admin

**Ops app**:
The licensing control plane UI (`apps/ops`) for the software operator and business owner. Deferred from the scaffold; `/ops` API mount may exist without this UI.
_Avoid_: Operator platform (that is a different repo), admin

**Backend scaffold**:
The monorepo foundation and Fastify composition root: workspace tooling, shared kernel, `/health`, audience mounts, OpenAPI export, Orval clients, Drizzle connected with no business schemas yet. Owns the repo root.
_Avoid_: Boilerplate, MVP backend

**Frontend scaffold**:
One Linear project that stands up both the Internal app and the Wholesale app with App Router structure, routing shells, Tailwind + shadcn-style primitives, shared UI packages, and Storybook — without merging the two apps into one Next.js project.
_Avoid_: UI boilerplate, “the frontend” (when you mean one of the two apps)

### Building blocks

**Shared kernel**:
Cross-context types only: `Money`, `Sku`, and branded IDs. Nothing else.
_Avoid_: Common, utils, core (as a dumping ground)

**DataTable**:
Staff-only list UI in `packages/ui-internal`, driven by OpenAPI `x-table` meta + Orval hooks. Never used as the Wholesale catalog.
_Avoid_: Grid, CRUD table (as the component name)

**Orval client**:
Generated TanStack Query hooks from committed OpenAPI specs. The only allowed way a Next.js app talks to the API.
_Avoid_: Hand-written fetch layer, API SDK (unless you mean these packages)

**Agent-optimized scaffold**:
Repo layout, scripts, tickets, and examples shaped so a coding agent can finish a slice from allowed paths + failing tests without inventing structure. Prefer boring, explicit, duplicated-if-clear over clever shared abstractions.
_Avoid_: “DX”, developer experience (when you mean agent success), flexible folder conventions
