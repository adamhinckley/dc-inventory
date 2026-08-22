---
title: "Scaffold Phase 1 HTTP/UI starting point"
tags: [wayfinder, research]
status: active
created: 2026-08-22
---

# Scaffold Phase 1 HTTP/UI starting point

Facts from the working tree at `/Users/adam/.buzz/REPOS/dc-inventory` (including uncommitted files inspected; none of those files change Identity/Catalog/Customers HTTP or the list/login pages). A Phase 1 spec must **extend** this surface, not replace it. No design recommendation.

Linear: [ADA-57](https://linear.app/adamhinckley/issue/ADA-57/scaffold-phase-1-httpui-starting-point). Parent map: [ADA-56](https://linear.app/adamhinckley/issue/ADA-56/phase-1-implementation-spec-map).

Uncommitted files on the dirty checkout (`packages/ui` AppShell / preference tests) do not add Fastify routes, Orval operations, login submit, or Drizzle identity/catalog/customers tables.

## Fastify `/internal/products` and `/wholesale/catalog`

Mounts are registered on the combined Fastify app (and per-audience OpenAPI apps) in [`apps/api/src/app.ts`](../../../apps/api/src/app.ts):

- `internalRoutes` at prefix `/internal`
- `wholesaleRoutes` at prefix `/wholesale`
- `opsRoutes` at prefix `/ops`

There is no Fastify `preHandler` for sessions on these mounts. Composition (`composeAppServices` in [`apps/api/src/infrastructure/composition.ts`](../../../apps/api/src/infrastructure/composition.ts)) wires `features`, `clock`, `database`, `PingUseCase`, and `ReadyCheckUseCase` only.

### `GET /internal/products` — empty stub

[`apps/api/src/internal/routes.ts`](../../../apps/api/src/internal/routes.ts):

```ts
typed(app).route({
  method: "GET",
  url: "/products",
  schema: {
    operationId: "listInternalProducts",
    tags: ["internal"],
    summary: "Stub product list for DataTable (x-table)",
    querystring: listQuerySchema,
    response: { 200: productListResponseSchema },
    "x-table": productsListTable,
  } as FastifySchema & { "x-table": typeof productsListTable },
  handler: async () => emptyProductList,
});
```

File comment: “Staff mount (`/internal`). Stubs from ADA-35; business routes come later.”

`emptyProductList` in [`apps/api/src/schemas.ts`](../../../apps/api/src/schemas.ts) is `{ items: [], page: 1, pageSize: 25, total: 0 }` — **empty**, not hardcoded product rows.

No other `/internal/*` routes exist in that file (no product CRUD, no customers HTTP, no `/internal/auth/*`).

HTTP inject test in [`apps/api/src/app.test.ts`](../../../apps/api/src/app.test.ts): `GET /internal/products` returns 200.

### `GET /wholesale/catalog` — hardcoded stub rows

[`apps/api/src/wholesale/routes.ts`](../../../apps/api/src/wholesale/routes.ts):

```ts
typed(app).route({
  method: "GET",
  url: "/catalog",
  schema: {
    operationId: "listWholesaleCatalog",
    tags: ["wholesale"],
    summary: "Stub catalog list for product-card examples",
    querystring: catalogQuerySchema,
    response: { 200: catalogListResponseSchema },
  },
  handler: async () => stubCatalogList,
});
```

No `x-table` on this operation. [`apps/api/src/openapi.test.ts`](../../../apps/api/src/openapi.test.ts) asserts wholesale YAML contains `/wholesale/catalog` and `listWholesaleCatalog`, and does **not** contain `x-table`.

`stubCatalogList` in [`apps/api/src/schemas.ts`](../../../apps/api/src/schemas.ts) is three hardcoded items (`total: 3`), comment: “Stub rows so the wholesale shop can render an example product-card list.” Example first row:

- `id: "7c9e6679-7425-40de-944b-e07fc1f90ae7"`
- `name: "Galvanized hex bolt"`
- `imageUrl: null`
- `wholesalePrice: 1250`
- `currency: "USD"`
- `available: 48`

`emptyCatalogList` is also defined in that file but is **not** the wholesale handler return value.

No other `/wholesale/*` routes exist in that file (no catalog-by-id, no `/wholesale/auth/*`).

HTTP inject test in [`apps/api/src/app.test.ts`](../../../apps/api/src/app.test.ts): `GET /wholesale/catalog` returns 200.

Ops (out of the ticket’s list endpoints, for completeness of mounts): [`apps/api/src/ops/routes.ts`](../../../apps/api/src/ops/routes.ts) `GET /subscription` → `stubOpsSubscription`.

## Zod list DTOs and `x-table`

All list DTOs live in [`apps/api/src/schemas.ts`](../../../apps/api/src/schemas.ts).

### Internal products

`listQuerySchema`: optional `q`; `page` (int ≥1, default 1); `pageSize` (1–100, default 25); `sortBy` enum `sku | name | available | createdAt` (default `sku`); `sortOrder` `asc | desc` (default `asc`); optional `status` enum `active | inactive`.

`productListItemSchema`: `id` (uuid string), `sku`, `name`, `onHand` (int), `onOrder` (int), `allocated` (int), `available` (int).

`productListResponseSchema`: `{ items, page, pageSize, total }`.

`productsListTable` (`x-table`):

- `rowId`: `"id"`
- columns: `sku`, `name`, `onHand`, `onOrder`, `allocated`, **`available`**
- search: param `q`, fields `sku`/`name`
- filters: `{ param: "status", control: "select" }`
- sort: default `sku`/`asc`; fields `sku`, `name`, `available`, `createdAt`

The same `x-table` object is copied onto the OpenAPI operation via [`apps/api/src/swagger-transform.ts`](../../../apps/api/src/swagger-transform.ts) (`jsonSchemaTransform` plus copy of `x-table`). Committed spec: [`openapi/internal.yaml`](../../../openapi/internal.yaml) (`operationId: listInternalProducts`, `x-table` columns include `available`).

Staff UI duplicates the meta (does not import the API package): [`apps/internal/src/lib/products-list-table.ts`](../../../apps/internal/src/lib/products-list-table.ts) comment: “Same shape as `productsListTable` on GET /internal/products (`x-table`). Copied so this app does not import the API package.”

### Wholesale catalog

`catalogQuerySchema`: optional `q`, optional `category`; `page`/`pageSize` same defaults; `sortBy` enum `name | available` (default `name`); `sortOrder` `asc | desc`.

`catalogItemSchema`: `id` (uuid), `name`, `imageUrl` (nullable string), `wholesalePrice` (int), `currency`, **`available`** (int).

`catalogListResponseSchema`: `{ items, page, pageSize, total }`.

No `x-table` constant for wholesale. Committed spec: [`openapi/wholesale.yaml`](../../../openapi/wholesale.yaml).

Query-string `available` is a **sort field and a response number**, not a writable body field. Handlers ignore query params (they return constants).

## Drizzle in `apps/api`; absence of context packages

Kit home is the API app. Barrel [`apps/api/src/infrastructure/schema.ts`](../../../apps/api/src/infrastructure/schema.ts) comment: “Drizzle table models — one Postgres schema per bounded context.” Re-exports identity, catalog, customers (and other contexts). `export const schema = { … }` registers `products`, `productIdentifiers`, `productPackaging`, `categories`, `productCategories`, `productImages`, `opsUsers`, `staffUsers`, `wholesaleUsers`, `sessions`, `customers`, `contacts`, `shipTos`, `exemptionCertificates`, plus purchasing/inventory/sales/tax/accounting/licensing/operator-bridge tables.

[`apps/api/README.md`](../../../apps/api/README.md): “There is no `packages/db` and no second Kit config.” [`tests/phase0-er-lift-schema.test.ts`](../../../tests/phase0-er-lift-schema.test.ts) asserts `packages/db` does not exist.

Workspace packages on disk: `packages/api-client-internal`, `packages/api-client-wholesale`, `packages/api-client-ops`, `packages/shared-kernel`, `packages/ui`, `packages/ui-internal`. **`packages/identity`, `packages/catalog`, and `packages/customers` do not exist.** `pnpm-workspace.yaml` is `apps/*` + `packages/*`. [`docs/stack.md`](../../stack.md) §2 *recommended* layout lists `packages/identity/ … catalog/ …` as the target shape; those folders are not in the tree.

### Identity tables

[`apps/api/src/infrastructure/schema/identity.ts`](../../../apps/api/src/infrastructure/schema/identity.ts):

- File comment: “Three actor kinds exist without Better Auth or staff roles. Sessions store an opaque id + actor_type + actor_id only.”
- Postgres schema `identity`
- Enums: `ops_user_kind` (`operator`, `business_owner`); `actor_type` (`staff`, `wholesale`, `ops`)
- `ops_users`: `id`, `email` unique, `kind`, `tenant_id` default `"DEFAULT"`, timestamps
- `staff_users`: `id`, `email` unique, timestamps
- `wholesale_users`: `id`, `email` unique, `customer_id` FK → `customers.id`, timestamps
- `sessions`: `id`, `actor_type`, `actor_id`, timestamps. Comment: “Opaque session id. No JWT / cookie-name columns. actor_id is polymorphic.”

No `password`, `password_hash`, role, or Better Auth tables. [`tests/phase0-er-lift-schema.test.ts`](../../../tests/phase0-er-lift-schema.test.ts): “defines identity users and opaque sessions without Better Auth or RBAC”; sources/SQL must not match `password_hash`, `betterAuth|better_auth`, `role`, `rbac`.

### Catalog tables

[`apps/api/src/infrastructure/schema/catalog.ts`](../../../apps/api/src/infrastructure/schema/catalog.ts):

- Comment: “Shop price is MP (`member_price_cents`). `list_price_cents` is a dump stub — shop / cart / snapshots must not read it. Wholesale visibility is `web_wholesale` only.”
- `catalog.products`: `sku` unique, `name`, `description`, `uom`, dimension/material dump columns, `member_price_cents` (required bigint), `list_price_cents` (nullable), `currency` char(3) default `USD`, `catalog_page`, `default_order_qty`, weight defaults, flags `inactive`/`discontinued`/`non_stock`/`no_export`/`web_wholesale`/`web_retail`, `tax_category_code`, timestamps
- Also: `product_identifiers`, `product_packaging`, `categories`, `product_categories`, `product_images` (`object_key`, `content_type`)

There is **no quantity / `available` column** on `catalog.products`. List DTO `onHand`/`onOrder`/`allocated`/`available` are HTTP stub fields only.

### Customers tables

[`apps/api/src/infrastructure/schema/customers.ts`](../../../apps/api/src/infrastructure/schema/customers.ts):

- Comment: “Terms are free text (G6 stays open). Contacts are id + customer_id + timestamps only — do not invent name/email/phone.”
- `customers.customers`: `name`, `credit_limit_cents`, `currency`, `terms`
- `contacts`: `id`, `customer_id`, timestamps only
- `ship_tos`: address lines, `is_default`
- `exemption_certificates`: `object_key`, `jurisdiction`, `entity_use_code`, `expires_at`, `status`

No Fastify customers list/CRUD routes under `apps/api/src`.

## Internal catalog page and login

### Catalog / products list

- Route: [`apps/internal/src/app/(dashboard)/catalog/page.tsx`](../../../apps/internal/src/app/(dashboard)/catalog/page.tsx) — server page; maps URL search params via `listParamsFromSearchParams(productsListTable, …)`; renders `<CatalogTable initialParams={…} />`. Copy: “Staff product list from the internal API. Quantities are displayed as returned — this page does not write inventory.”
- Table: [`apps/internal/src/components/catalog-table.tsx`](../../../apps/internal/src/components/catalog-table.tsx) — `"use client"`; **Orval** hook `useListInternalProducts` from `@dc-inventory/api-client-internal`; `DataTable.Root` from `@dc-inventory/ui-internal` with `meta={productsListTable}` and `queryHook={useListInternalProducts}`.
- Guard: [`apps/internal/src/lib/orval-only.test.ts`](../../../apps/internal/src/lib/orval-only.test.ts) requires `useListInternalProducts` and forbids `\bfetch\s*(` in non-test app sources.

Dashboard chrome: [`apps/internal/src/components/dashboard-frame.tsx`](../../../apps/internal/src/components/dashboard-frame.tsx) — AppShell nav from [`apps/internal/src/lib/dashboard-routes.ts`](../../../apps/internal/src/lib/dashboard-routes.ts) includes Catalog (`/catalog`) and Customers (`/customers`). Topbar link `href="/login"` “Sign in”. No session gate in [`apps/internal/src/app/(dashboard)/layout.tsx`](../../../apps/internal/src/app/(dashboard)/layout.tsx).

Customers page is **not** Orval: [`apps/internal/src/app/(dashboard)/customers/page.tsx`](../../../apps/internal/src/app/(dashboard)/customers/page.tsx) — `DashboardPlaceholder` body “Placeholder customers list. A later ticket will wire the customers Orval list hook.”

No `apps/internal/src/middleware.ts`.

### Login

[`apps/internal/src/app/(auth)/login/page.tsx`](../../../apps/internal/src/app/(auth)/login/page.tsx):

```ts
function onSubmit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
}
```

Copy: “Placeholder staff login. Session binding lands with Identity.” Email + password fields; submit does not call Orval or `fetch`. Layout [`apps/internal/src/app/(auth)/layout.tsx`](../../../apps/internal/src/app/(auth)/layout.tsx) links to `/catalog`.

App [`apps/internal/package.json`](../../../apps/internal/package.json): Next 15 port 3000; deps `@dc-inventory/api-client-internal`, `@dc-inventory/ui`, `@dc-inventory/ui-internal`, TanStack Query. No Better Auth package.

## Wholesale shop catalog and login

- Shop home [`apps/wholesale/src/app/(shop)/page.tsx`](../../../apps/wholesale/src/app/(shop)/page.tsx): `redirect("/products")`.
- Catalog list [`apps/wholesale/src/app/(shop)/products/page.tsx`](../../../apps/wholesale/src/app/(shop)/products/page.tsx) renders `<ProductCardList />`. Copy: “Wholesale prices and availability from the catalog API. Availability is displayed as returned — this page does not compute stock.”
- [`apps/wholesale/src/components/product-card-list.tsx`](../../../apps/wholesale/src/components/product-card-list.tsx): **Orval** `useListWholesaleCatalog()` from `@dc-inventory/api-client-wholesale`; pending/error/empty states; maps `catalog.data.data.items` into `ProductCard` (`id`, `name`, `imageUrl`, `wholesalePrice`, `currency`, `available`).
- [`apps/wholesale/src/components/product-card.tsx`](../../../apps/wholesale/src/components/product-card.tsx): link `href={`/products/${id}`}` (path param is named `sku` in the Next file but the stub passes UUID `id`). Displays `formatMoneyMinorUnits(wholesalePrice, currency)` labeled “wholesale”; `available > 0` vs “Unavailable”.
- PDP [`apps/wholesale/src/app/(shop)/products/[sku]/page.tsx`](../../../apps/wholesale/src/app/(shop)/products/[sku]/page.tsx): `ShopPlaceholder` — “A catalog-by-id Orval hook is not on the stub yet.”
- Shop does not import DataTable: [`apps/wholesale/src/lib/no-datatable.test.ts`](../../../apps/wholesale/src/lib/no-datatable.test.ts).

Header [`apps/wholesale/src/components/shop-header.tsx`](../../../apps/wholesale/src/components/shop-header.tsx): Products/Orders/Cart/Checkout + `href="/login"` “Sign in”. Layout [`apps/wholesale/src/app/(shop)/layout.tsx`](../../../apps/wholesale/src/app/(shop)/layout.tsx) has no session gate. No `apps/wholesale/src/middleware.ts`.

Login [`apps/wholesale/src/app/(auth)/login/page.tsx`](../../../apps/wholesale/src/app/(auth)/login/page.tsx): same placeholder `preventDefault` submit. Copy: “Placeholder wholesale-client login. Session binding lands with Identity.” Layout links to `/products`.

[`apps/wholesale/package.json`](../../../apps/wholesale/package.json): Next 15 port 3002; `@dc-inventory/api-client-wholesale` + TanStack Query. No `@dc-inventory/ui-internal`. No Better Auth.

## `IFileStorage`, Better Auth, session middleware, auth routes, deps

### `IFileStorage`

Named as a **future port** in docs, not implemented in TypeScript under `apps/` or `packages/` (no `export interface IFileStorage` in application code). Citations:

- [`docs/architecture.md`](../../architecture.md) “Ports that will exist early”: `IFileStorage` | Shared port | S3, local disk, in-memory
- [`docs/stack.md`](../../stack.md) Files row: S3-compatible via `IFileStorage`; mapping “S3/R2 SDK → IFileStorage adapter”
- [`docker-compose.yml`](../../../docker-compose.yml) comment: “MinIO is in the box so object storage can wait; do not wire IFileStorage here.” MinIO service is present.
- [`apps/api/README.md`](../../../apps/api/README.md): “MinIO is in Compose so object storage is in the box. Do not wire `IFileStorage`.”
- [`docs/demo-assumptions.md`](../../demo-assumptions.md): “Catalog image **upload** against MinIO. … `IFileStorage` is not wired.”
- Catalog persistence already has `product_images.object_key` ([`apps/api/src/infrastructure/schema/catalog.ts`](../../../apps/api/src/infrastructure/schema/catalog.ts)); customers have `exemption_certificates.object_key`. No upload HTTP.

Root and `apps/api` `package.json` have no MinIO/AWS SDK/`IFileStorage` adapter package.

### Better Auth

- **Not** in any `package.json` (`better-auth` string absent from workspace package manifests).
- [`docs/stack.md`](../../stack.md) §2: “Auth library | **Better Auth** (or equivalent session library) **as an Identity adapter only**”; §3 mapping “Better Auth → Identity adapter”; §5: “Identity is a bounded context. Better Auth (or similar) is an **adapter**, not the domain.” Documented cookie names (not implemented in code): `staff_session`, `wholesale_session`, `ops_session`; documented login paths `/internal/auth/*`, `/wholesale/auth/*`, `/ops/auth/*` for rate-limit — **those routes are not registered**.
- [`docs/demo-assumptions.md`](../../demo-assumptions.md): “Better Auth (Phase 1).” listed under “Explicitly out of this demo phase” (Phase 0).
- Application-layer tests forbid importing `better-auth`: [`apps/api/src/application/ping.test.ts`](../../../apps/api/src/application/ping.test.ts), [`apps/api/src/application/ready.test.ts`](../../../apps/api/src/application/ready.test.ts).

### Session / cookie HTTP

- Fastify hooks in [`apps/api/src/app.ts`](../../../apps/api/src/app.ts): request-id (`registerRequestIdHook`), health, ping, audience mounts. No `@fastify/cookie`, `@fastify/session`, or `@fastify/cors` in [`apps/api/package.json`](../../../apps/api/package.json) (deps: `@fastify/swagger`, `drizzle-orm`, `fastify`, `fastify-type-provider-zod`, `postgres`, `yaml`, `zod`).
- [`apps/api/src/infrastructure/request-id.ts`](../../../apps/api/src/infrastructure/request-id.ts) is `x-request-id` echo, not auth.
- Pino redact includes `req.headers.cookie` / `set-cookie` ([`apps/api/src/infrastructure/logging.ts`](../../../apps/api/src/infrastructure/logging.ts)) — logging policy, not session parsing.
- Orval mutators already send cookies on **outbound** browser fetch: both [`packages/api-client-internal/src/custom-fetch.ts`](../../../packages/api-client-internal/src/custom-fetch.ts) and [`packages/api-client-wholesale/src/custom-fetch.ts`](../../../packages/api-client-wholesale/src/custom-fetch.ts): `credentials: "include"` against `process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"`. Comment: “Orval fetch mutator: cookie auth (`credentials: "include"`) against apps/api.” The API does not set those cookies today.

Postgres `identity.sessions` exists (see Identity tables). No use case reads or writes it.

## Orval operation ids

[`orval.config.ts`](../../../orval.config.ts) generates three clients from `openapi/{internal,wholesale,ops}.yaml`.

| Audience | HTTP | `operationId` | Generated function / hook |
|---|---|---|---|
| Internal | `GET /internal/products` | `listInternalProducts` | `listInternalProducts`, `useListInternalProducts` in [`packages/api-client-internal/src/generated/api.ts`](../../../packages/api-client-internal/src/generated/api.ts) |
| Wholesale | `GET /wholesale/catalog` | `listWholesaleCatalog` | `listWholesaleCatalog`, `useListWholesaleCatalog` in [`packages/api-client-wholesale/src/generated/api.ts`](../../../packages/api-client-wholesale/src/generated/api.ts) |
| Ops | `GET /ops/subscription` | `getOpsSubscription` | (ops client; not used by internal/wholesale apps) |

URL builders: `getListInternalProductsUrl` → `/internal/products`; `getListWholesaleCatalogUrl` → `/wholesale/catalog`.

Generated item types include `available` ([`packages/api-client-internal/src/generated/model/listInternalProducts200ItemsItem.ts`](../../../packages/api-client-internal/src/generated/model/listInternalProducts200ItemsItem.ts); [`packages/api-client-wholesale/src/generated/model/listWholesaleCatalog200ItemsItem.ts`](../../../packages/api-client-wholesale/src/generated/model/listWholesaleCatalog200ItemsItem.ts)). Wholesale item also has `wholesalePrice` / `imageUrl`.

Packages re-export generated API from [`packages/api-client-internal/src/index.ts`](../../../packages/api-client-internal/src/index.ts) (`export * from "./generated/api"`). Same pattern for wholesale.

There is no generated customers list operation.

## Scaffold orientation (secondary to code)

[`CONTEXT.md`](../../../CONTEXT.md) Current scaffold: Fastify stub `/internal`, `/wholesale`, `/ops` mounts; Drizzle tables including identity/catalog/customers; `pnpm gen:api` writes committed OpenAPI + Orval clients; `apps/internal` uses AppShell; `apps/wholesale` is a separate App Router shop.

## Claim checklist (ticket bullets)

| Ticket ask | Fact |
|---|---|
| `/internal/products` stub vs empty vs hardcoded | Empty list constant (`emptyProductList`). |
| `/wholesale/catalog` | Hardcoded three-row `stubCatalogList`. |
| Zod + `x-table` including qty/`available` | Internal `x-table` columns include `onHand`/`onOrder`/`allocated`/`available`; wholesale DTO has `available` and sortBy `available`, no `x-table`. |
| Drizzle identity/catalog/customers in API | Yes, under `apps/api/src/infrastructure/schema/`. |
| `packages/identity`, `catalog`, `customers` | Do not exist. |
| Internal catalog page | Orval `useListInternalProducts` + DataTable. |
| Internal login | Placeholder `preventDefault`; no API. |
| Wholesale catalog page | Yes: `/products` + `useListWholesaleCatalog`; home redirects there. PDP placeholder. |
| Wholesale login | Same placeholder pattern. |
| `IFileStorage` | Docs/port name only; MinIO unwired. |
| Better Auth / session middleware / auth routes | Not in code; sessions table only; Orval already `credentials: "include"`. |
| Orval ids | `listInternalProducts`, `listWholesaleCatalog`. |
