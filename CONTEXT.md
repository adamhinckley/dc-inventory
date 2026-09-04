# DC Inventory — context

Wholesale inventory control: catalog, stock ledger, purchasing, wholesale shop, customers, thin AR, software licensing.

This file orients agents. The contracts live in `docs/`.

## Start here

1. [`AGENTS.md`](./AGENTS.md) — vendor-neutral repo contract (read first)
2. [`docs/architecture.md`](./docs/architecture.md) — module map, autonomy, work packets
3. [`docs/invariants.md`](./docs/invariants.md) — locked rules (do not invent §18 defaults)
4. [`docs/stack.md`](./docs/stack.md) — TypeScript, Fastify, Drizzle, Postgres, Better Auth, Next.js
5. [`docs/api-contract.md`](./docs/api-contract.md) — OpenAPI, Orval, tables vs shop

Also: [`docs/tax.md`](./docs/tax.md) (no sales tax), [`docs/customers.md`](./docs/customers.md), [`docs/licensing.md`](./docs/licensing.md), [`docs/operator-bridge.md`](./docs/operator-bridge.md), [`docs/observability.md`](./docs/observability.md), [`docs/linear.md`](./docs/linear.md).

## Current scaffold

Root pnpm workspace (`apps/*`, `packages/*`), TypeScript `strict: true`, Vitest, Node >=24, and `packages/shared-kernel` (`Money`, `Sku`, branded IDs including `OrganizationId`). Fastify lives in `apps/api`: composition root + DI in `apps/api/src/infrastructure`, Drizzle + postgres.js (`DATABASE_URL`, catalog / purchasing / inventory / identity / customers / sales / accounting / licensing / operator_bridge tables; leftover empty `tax` schema — do not extend), `GET /health` (no DB) + `GET /ready` (`SELECT 1`), Pino JSON + `requestId`, Ping golden path, and stub `/internal`, `/wholesale`, and `/ops` mounts. Root Compose starts Postgres 18 + MinIO (placeholders; MinIO is unwired). `pnpm db:migrate` runs Drizzle Kit in the API app only. Required CI starts Compose, migrates, and fails if `GET /ready` cannot reach Postgres; `pnpm test` stays in-memory. Demo-only locks live in [`docs/demo-assumptions.md`](./docs/demo-assumptions.md) and are not [`docs/invariants.md`](./docs/invariants.md) §18. Multi-organization seam is **current** ([`docs/adr/0007-organization-id-current-not-deferred.md`](./docs/adr/0007-organization-id-current-not-deferred.md), [Linear Multi-organization](https://linear.app/adamhinckley/project/multi-organization-c54d6b9bb02b)); v1 demo still runs one implicit org (`DEFAULT`). Available-to-sell / per-SKU open vs locked is **current** ([`docs/adr/0008-available-to-sell-open-locked.md`](./docs/adr/0008-available-to-sell-open-locked.md)); the ledger still computes warehouse `available = on_hand − allocated` and does not yet implement `Committed` or `availableToSell`. `pnpm gen:api` writes committed OpenAPI YAML and Orval clients (`packages/api-client-*`). `packages/ui` is the **internal dashboard** design system: Tailwind v4, Carbon White / g100 hex on semantic tokens, Base UI primitives, AppShell, Storybook (`pnpm storybook`). Form controls share `--space-input-height`; see [`docs/work-dashboard-design-spec.md`](./docs/work-dashboard-design-spec.md) §12. `packages/ui-internal` is the staff `DataTable` (`{ meta, queryHook }` + `x-table` meta) and Recharts. `apps/internal` uses AppShell. `apps/wholesale` is an App Router shop with its own canvas/ink tokens — same layout *principles* as the dashboard kit, not the same components. Ops UI is deferred.

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
The monorepo foundation and Fastify composition root: workspace tooling, shared kernel, `/health`, audience mounts, OpenAPI export, Orval clients, Drizzle connected with catalog / purchasing / inventory / identity / customers / sales / accounting / licensing / operator_bridge tables (leftover empty `tax` schema — do not extend). Owns the repo root.
_Avoid_: Boilerplate, MVP backend

**Frontend scaffold**:
One Linear project that stands up both the Internal app and the Wholesale app with App Router structure, routing shells, Tailwind + shadcn-style primitives, shared UI packages, and Storybook — without merging the two apps into one Next.js project.
_Avoid_: UI boilerplate, “the frontend” (when you mean one of the two apps)

### Stock and demand

**Available**:
Warehouse leftover at a SKU: `on_hand` minus `allocated`. Always non-negative. Not what a customer may buy.
_Avoid_: available to sell, ATP (as the shop number), on the shelf (as the only gate)

**Available to sell**:
What a customer may still buy. Locked SKU: `on_hand + on_order − committed`. Open SKU: no numeric cap. Inventory computes it. UIs do not.
_Avoid_: available, ATP, on-hand

**Committed (pre-sold)**:
Confirmed sales-order quantity not yet shipped or decommitted. The demand side of available to sell. SoloView dump `on_order_qty` (“on order”) is this number.
_Avoid_: allocated (that is warehouse cover), reserved, on pick list, inbound / Qty On PO

**On order / Qty On PO**:
Inbound factory PO quantity not yet received. Snapshot field `on_order`. David’s “Qty On PO.”
_Avoid_: dump `on_order_qty` (that is committed)

**Allocated**:
Warehouse cover against `on_hand` for committed demand. Ship only against this. Never exceeds `on_hand`.
_Avoid_: pre-sold, committed, available

**Open**:
Per-SKU sell state. Confirm does not cap quantity on sellability. Default for a new SKU, and after staff reopen for the next pre-sell.
_Avoid_: selling season, company-wide infinite, unlocked

**Locked**:
Per-SKU sell state after a factory PO is placed (`InboundFromPo`). Gate is available to sell. Stays locked until staff reopens. Receive does not reopen.
_Avoid_: closed season, sold out as a company flag

**Uncovered**:
`max(0, committed − on_hand − on_order)`. The factory to-order list. Not a shop number.
_Avoid_: available to sell, backorder document, purchase request

### Customers

**Customer**:
Wholesale buyer account of this company. Every customer is a reseller; this company does not sell to taxable end-users. Commercial identity only — not the shop login and not the order history.
_Avoid_: Client, account (when you mean the buyer), wholesale user, tax status, taxable customer

**Customer number**:
Human-readable identifier unique per organization. Not the UUID `CustomerId`. Visible on the internal app and the wholesale app. On create: blank → system issues `CUST-#####`; staff may instead enter a legacy number from a prior system (any unique string). Immutable after first save.
_Avoid_: Customer ID, account code, ClientId

**Ship-to**:
Destination address on the customer. Copied onto the sales order at confirm.
_Avoid_: Shipping address (as the record name), sleeping address, billing address

**Bill-to**:
The single address used to invoice the customer. Separate from ship-to. A customer may exist without one; ship refuses until it exists. Copied onto the invoice at ship.
_Avoid_: Billing address (as the record name), shipping address, ship-to

**Customer note**:
Free text the wholesale customer writes on their account. Staff and the customer can read it. Only the customer can edit it.
_Avoid_: Staff note, comment, shared memo (as if there is one note)

**Staff note**:
Free text staff write on the customer. Only the internal app can read or edit it. The wholesale app never sees it.
_Avoid_: Customer note, internal-only as the only note, comment

**Account status**:
Whether staff will take new business from this customer: active, on hold, or inactive. Hold freezes confirm and staff-on-behalf; login and payment stay. Inactive closes the shop login and new drafts; staff still record payments. Already-confirmed orders may still ship.
_Avoid_: Credit limit (that is money), unpaid, archived

**Exemption certificate**:
A resale document on a Customer. Jurisdiction is required; entity-use, expiry, and file are optional. The wholesale customer or staff may attach the file. Evidence only — not a sales gate, not tax math.
_Avoid_: Tax status, tax-exempt certificate (as the record name), certificate as the customer header

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

**Demo reconciliation**:
The assertions `pnpm seed:demo` runs against the finished book before it reports success. Exact master and document counts, engine-issued document-number endpoints, stock recomputed from movements, invoice remainder, Demo payment completeness, Demo AR age buckets, leftover open documents, and Demo low-stock. Callers inject a read port. The assertion module owns the calculations. A mismatch names the failed contract and exits 1.
_Avoid_: Treating `available` or `availableToSell` as an input, duplicating these formulas in dashboard SQL, presenting a partial book as ready
