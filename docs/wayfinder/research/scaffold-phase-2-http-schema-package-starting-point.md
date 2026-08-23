# Scaffold Phase 2 HTTP/schema/package starting point

Facts only. No design recommendation.

Ticket: [Scaffold Phase 2 HTTP/schema/package starting point](https://linear.app/adamhinckley/issue/ADA-82/scaffold-phase-2-httpschemapackage-starting-point)

Recorded 2026-08-23 from `main` at `152c509`.

## Packages

These Phase 1 context packages exist under `packages/`:

- `packages/identity` (`@dc-inventory/identity`)
- `packages/catalog` (`@dc-inventory/catalog`)
- `packages/customers` (`@dc-inventory/customers`)
- `packages/shared-kernel` (`@dc-inventory/shared-kernel`)
- UI / Orval client packages (`packages/ui`, `packages/ui-internal`, `packages/api-client-*`)

These paths do **not** exist: `packages/inventory`, `packages/purchasing`, `packages/sales`, `packages/accounting`, `packages/tax`.

`pnpm-workspace.yaml` is `apps/*` and `packages/*`. `apps/api/package.json` depends on identity, catalog, customers, and shared-kernel only.

## Drizzle tables already in the API app

Table files live in `apps/api/src/infrastructure/schema/` (not in context packages for inventory/purchasing/sales/accounting/tax).

### Inventory (`inventory.ts`)

- `locations`: `id`, `code` (unique), `is_pick_bin`, timestamps. Comment: `` `code` may be DEFAULT for v1 ATP. Named bins are not Phase 0. ``
- `reorder_policies`: `sku`, `location_id`, `min_on_hand`, `max_on_hand`, unique `(sku, location_id)`
- `stock_movements`: `sku`, `location_id`, `movement_type`, `qty` (integer, notNull, no check), `ref_type`, `ref_id`, `created_at`. Primary key `id` only. **No unique** on `(ref_type, ref_id, sku, movement_type)`.
- `stock_snapshots`: `sku`, `location_id`, `on_hand`, `allocated`, `on_order`, generated `available` as `on_hand - allocated`, unique `(sku, location_id)`

Enums in this Drizzle file: `InboundFromPo`, `GoodsReceived`, `Allocated`, `Deallocated`, `Shipped`, `Adjustment`. Ref types: `purchase_order`, `sales_order`.

### Purchasing (`purchasing.ts`)

- `suppliers`: `vendor_number` unique, `name`
- `supplier_products`: supplier × sku, optional supplier sku / mins / last PO cost
- `purchase_orders`: `id`, `supplier_id`, timestamps. Comment: "Thin PO header — no document number, no G9 status machine."
- `purchase_order_lines`: frozen `sku`, `name`, `qty`. No unit cost column.

### Sales (`sales.ts`)

- `orders`: `customer_id`, `status` enum `draft | confirmed | shipped | cancelled`, typed ship-to snapshot columns, no document number
- `order_lines`: frozen `sku`, `name`, `qty`, `unit_price_cents`, `currency`, optional `tax_category_code`

### Accounting (`accounting.ts`)

- `invoices`: `order_id`, `customer_id`, `status` `unposted | posted`, `posted_at`, `subtotal_cents`, **`tax_total_cents` notNull**, `total_cents`, `currency`. No document number.
- `invoice_tax_lines`: frozen jurisdiction / rate_bps / tax cents. Comment: "Same shape as tax_commit_lines. Frozen. No live FK to tax."
- `payments`, `payment_applications`: amount cents + currency; no idempotency column

### Tax (`tax.ts`)

- `tax_commits`: optional `order_id` and `invoice_id` (nullable `.references`), `engine_transaction_id`, status `quoted | committed | voided`
- `tax_commit_lines`: same money/rate shape as invoice tax lines

No inventory/purchasing/sales/accounting/tax **use cases** or HTTP controllers exist in `apps/api` beyond schema + the qty-read adapter below.

## Qty read path (Catalog, not Inventory writers)

`packages/catalog/src/domain/ports/qty-read.ts` exports `IQtyReadPort.readBySkus`. Comment: missing snapshot is omitted; callers treat that as 0. Catalog never writes qty through this port.

Staff/wholesale list/get use cases use `snapshots.get(...) ?? ZERO_QTY` (`packages/catalog/src/application/list-staff-products.ts`, `list-wholesale-catalog.ts`, get-product variants).

Postgres adapter: `apps/api/src/adapters/stock-snapshot-qty-read.ts` class `StockSnapshotQtyReadAdapter implements IQtyReadPort`. Constant `DEFAULT_LOCATION_CODE = "DEFAULT"`. JSDoc says it reads snapshots for location code `DEFAULT`. Missing location or snapshot → empty map (callers → 0). Lives in the API app so Catalog Postgres does not import inventory tables.

The locations schema comment uses `DEFAULT`. The adapter constant is `"DEFAULT"`. No seed currently writes a locations row.

There is no Inventory HTTP and no movement writer.

## HTTP and OpenAPI

`apps/api/src/internal/routes.ts` registers auth, customers, products only.

`apps/api/src/wholesale/routes.ts` registers auth and catalog only.

`openapi/internal.yaml` paths: `/internal/auth/*`, `/internal/customers…`, `/internal/products…`. No purchase orders, orders, invoices, payments, or stock movements.

`openapi/wholesale.yaml` paths: `/wholesale/auth/*`, `/wholesale/catalog`, `/wholesale/catalog/{id}`. No cart, checkout, or orders.

## UI

Internal, real list: `apps/internal/src/app/(dashboard)/catalog/page.tsx` (staff products table; copy says quantities are displayed as returned and the page does not write inventory).

Internal placeholders (`DashboardPlaceholder`):

- `apps/internal/src/app/(dashboard)/inventory/page.tsx`
- `apps/internal/src/app/(dashboard)/purchasing/page.tsx`
- `apps/internal/src/app/(dashboard)/sales/page.tsx`
- `apps/internal/src/app/(dashboard)/accounting/page.tsx`

Wholesale catalog list/PDP exist. Placeholders (`ShopPlaceholder`):

- `apps/wholesale/src/app/(shop)/cart/page.tsx`
- `apps/wholesale/src/app/(shop)/checkout/page.tsx` (copy: tax will display from a quoted API total only)
- `apps/wholesale/src/app/(shop)/orders/page.tsx`

## Phase 1 seed

`apps/api/src/seed/run-phase1-seed.ts` upserts: customer **Acme Wholesale**, staff `staff@local.test`, wholesale `wholesale@local.test`, five catalog products.

Comment on `runPhase1Seed`: "Does not write contacts, ship-tos, exemptions, ops users, sessions, or stock snapshots."

No `locations` row, no `suppliers`, no POs, no orders, no invoices, no movements.

## How list qty becomes non-zero

If a snapshot row exists for the location the adapter queries (`locations.code = "DEFAULT"`), `StockSnapshotQtyReadAdapter` returns `onHand` / `onOrder` / `allocated` / `available` and Catalog lists show those numbers.

If that location row is missing, or no snapshot row exists, lists show `ZERO_QTY` (all zeros). Catalog still does not write qty.
