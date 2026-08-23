# Phase 0 ledger columns vs architecture movement names

Facts only. No design recommendation.

Ticket: [Phase 0 ledger columns vs architecture movement names](https://linear.app/adamhinckley/issue/ADA-83/phase-0-ledger-columns-vs-architecture-movement-names)

Recorded 2026-08-23 from `main` at `152c509`.

## Movement type names

Three sources disagree on the inbound/receive labels. Allocated / Deallocated / Shipped / Adjustment match.

| Source | File | Inbound | Receive |
| --- | --- | --- | --- |
| Architecture | `docs/architecture.md` §6 table | `InboundFromPo` | `GoodsReceived` |
| Invariants | `docs/invariants.md` §5 "Movement types (locked)" | `InboundFromPo` | `GoodsReceived` |
| Drizzle | `apps/api/src/infrastructure/schema/inventory.ts` `movementType` | `InboundFromPo` | `GoodsReceived` |
| Migration | `apps/api/drizzle/migrations/0000_catalog_purchasing_inventory.sql` | `InboundFromPo` | `GoodsReceived` |

Architecture mermaid in the same §6 uses `InboundFromPo` / `GoodsReceived` (same as the table). Purchasing copy in architecture still says Inventory records `GoodsReceived`.

SQL enum (migration 0000):

```sql
CREATE TYPE "inventory"."movement_type" AS ENUM('InboundFromPo', 'GoodsReceived', 'Allocated', 'Deallocated', 'Shipped', 'Adjustment');
```

Drizzle enum array:

```ts
["InboundFromPo", "GoodsReceived", "Allocated", "Deallocated", "Shipped", "Adjustment"]
```

Ref type: Drizzle `purchase_order` / `sales_order`. SQL `movement_ref_type` AS ENUM `('purchase_order', 'sales_order')`.

## Qty sign and G2 unique key

`stock_movements.qty` is `integer NOT NULL` in Drizzle and in migration 0000. No `CHECK (qty > 0)`, no comment that qty is always positive. Sign convention is not encoded in the schema.

`stock_movements` has PK `id` and FK `location_id → locations.id`. **No unique** on `(ref_type, ref_id, sku, movement_type)` and no other unique besides PK. G2's recommended idempotency key is **not** in Phase 0.

## Snapshot formula and location code

`stock_snapshots.available` is `GENERATED ALWAYS AS (on_hand - allocated) STORED NOT NULL` (migration 0000 and Drizzle `generatedAlwaysAs(sql\`on_hand - allocated\`)`).

Persisted snapshot columns: `on_hand`, `allocated`, `on_order` (all integer, default 0). Unique `(sku, location_id)`.

`docs/invariants.md` read model:

```
on_hand     = receipts − shipments − adjustments
on_order    = open PO qty not yet received
allocated   = open sales-order qty not yet shipped
available   = on_hand − allocated
```

`locations.code` is unique text. Schema comment: `` `code` may be DEFAULT for v1 ATP. `` Qty adapter constant in `apps/api/src/adapters/stock-snapshot-qty-read.ts` is `"DEFAULT"`.

## Purchasing columns

`purchase_orders`: `id`, `supplier_id`, timestamps only. **No** `status`, **no** document number. Drizzle comment: "Thin PO header — no document number, no G9 status machine."

`purchase_order_lines`: `sku`, `name`, `qty`. No unit cost.

## Sales statuses vs G5 leftovers

SQL and Drizzle `sales.order_status`: `draft`, `confirmed`, `shipped`, `cancelled`.

No `partially_shipped` (or similar). No document number column. Ship-to is typed snapshot columns on `orders`, not a live `ship_to_id`.

## Accounting tax money and payments

`accounting.invoices.tax_total_cents` is `bigint NOT NULL` (migration 0001 and Drizzle). Same for `subtotal_cents` and `total_cents`. Status enum `unposted | posted`. **No** document number.

`invoice_tax_lines` FK to `invoices.id` only. Drizzle comment: "Same shape as tax_commit_lines. Frozen. No live FK to tax."

`payments` and `payment_applications` store `amount_cents` + `currency`. No reverse/void table. No unique idempotency key on payments.

## Tax quote/commit tables vs Accounting

`tax.tax_commit_status`: `quoted`, `committed`, `voided` (SQL `quoted` / `committed` / `voided` — same three).

`tax_commits.order_id` and `invoice_id` are **nullable** FKs to `sales.orders` and `accounting.invoices`. That is a live FK from Tax → Sales/Accounting, not the reverse.

Accounting does not FK to `tax_commits`. Invoice tax lines are a frozen copy.

No `ITaxCalculator` TypeScript port exists in `packages/` (no `packages/tax`).

## Phase 0 deny list (qty not on products)

`catalog.products` in migration 0000 has no `on_hand`, `allocated`, `on_order`, or `available`. Catalog schema in `packages/catalog` likewise has no qty columns. Phase 0 research [available generated column vs repository derivation](https://linear.app/adamhinckley/issue/ADA-46/available-generated-column-vs-repository-derivation) landed generated `available` on snapshots, not on products.

Dump qty fields named in `docs/database-design.md` (`onhand_qty`, `loc_onhand`, `onpicklist_qty`, `on_order_qty`) are documented as snapshot projections, not product columns.
