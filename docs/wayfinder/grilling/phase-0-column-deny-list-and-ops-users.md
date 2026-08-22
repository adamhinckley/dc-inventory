# Phase 0 column deny-list and ops users

**Ticket:** [ADA-44](https://linear.app/adamhinckley/issue/ADA-44/phase-0-column-deny-list-and-ops-users)
**Kind:** grilling (demo-only lock for the Phase 0 spec)
**Blocked by:** [ADA-43](https://linear.app/adamhinckley/issue/ADA-43/schema-columns-on-paper-vs-er-only) (research landed; gist in that ticket)
**Not product law:** do not edit [`invariants.md`](../../invariants.md) §18 or tick [`open-questions.md`](../../open-questions.md)

---

## Decision

Phase 0 persists **verified catalog identity, shop-price MP, visibility/status flags, packaging, identifiers, and relocated purchasing/inventory fields**. It **omits unverified dump-only columns**. It keeps **two nullable stubs**: list price and `web_retail`. It **adds** `identity.ops_users` (missing from the design ER, required by stack/licensing).

Wholesale shop price is **`member_price_cents` (MP) only**. Order-line snapshots copy that amount. Do not persist three live prices.

---

## Policy (how to classify)

| Bucket | Meaning for the Phase 0 Drizzle skeleton |
| --- | --- |
| **Include** | Named column on the owning table. Required unless noted nullable for empty dump values (`description`, dimensions, …). |
| **Omit** | No column. No boolean “maybe later.” Re-add only with a later additive migration after the business verifies meaning. |
| **Nullable stub** | Column exists so a dump import can store the value. Demo use cases **must not** read it for shop price, ATP, commission, or a retail channel. |

Rules used here (from [ADA-41](https://linear.app/adamhinckley/issue/ADA-41/phase-0-implementation-spec-map)):

- Demo locks: invoice on ship; cart = draft sales order; **block oversell**; **MP is shop price**; in-memory tax.
- Schema: tables + PKs/FKs + money/qty/SKU types from [`database-design.md`](../../database-design.md); **omit unverified dump-only columns**.
- Identity tables from the design doc **plus** the ops user table named in [`stack.md`](../../stack.md) / [`licensing.md`](../../licensing.md). Better Auth mapping is Phase 1.

---

## Must-settle items

| Topic | Dump / paper name | Phase 0 | Why |
| --- | --- | --- | --- |
| Carton-to-carton | `c_to_c` → `carton_to_carton` | **Omit** | Design: unknown meaning, do not guess. Glossary unverified (carton-to-carton **or** cost-to-cost). |
| Line commission | `line_comm` → `line_commission` | **Omit** | Flag vs amount unverified. No commission context in the demo. |
| Oversold discount | `disc_over_sold`, `disc_over_sold_percent` | **Omit** | Unverified policy fields. Demo **blocks** oversell — a discount-on-oversell path would contradict the lock. |
| Secondary name | `item2` → `secondary_name` | **Omit** | Design: drop if unused. Glossary unverified. No dump sample in-repo proving it is required copy. |
| Three prices vs MP | `lp_price`, `mp_price`, `original_wholesale_price` | **MP include**; **LP stub**; **original omit** | Demo lock: MP is the shop price. LP meaning still “confirm.” Original wholesale is unverified history. |
| Consumer storefront flag | `webretail` → `web_retail` | **Nullable stub** | Meaning is known (retail visibility). Retail/Shopify is not v1. Persist `boolean not null default false`; wholesale shop filters **`web_wholesale` only**. |
| Ops / operator users | — (not in design ER) | **Include** `identity.ops_users` | Architecture X1 + stack actor model + licensing §9. Sessions `actor_type` includes `ops`. |

---

## `catalog.products` — include

Money is integer cents. Quantities are integers. SKU is unique text.

| Column | Source | Notes |
| --- | --- | --- |
| `id` | — | UUID PK |
| `sku` | `product_id` | Unique stock-keeping identity |
| `name` | `item` | |
| `description` | `detail` | Nullable |
| `uom` | `uom` | Sell / inventory unit |
| `country_of_origin` | `c_of_o` | Nullable |
| `material` | `material` | Nullable |
| `length` `width` `height` `diameter` `size` | matching | Product body, not carton; nullable |
| `weight` `weight_uom` | `wt` `wt_uom` | Nullable |
| `member_price_cents` | `mp_price` | **Shop / snapshot price.** Integer cents + currency stored with `Money` rules (currency is tenant-default USD for the demo). |
| `catalog_page` | `catalog_pg_num` | Nullable |
| `default_order_qty` | `def_qty` | Nullable |
| `default_weight` `default_weight_uom` | `def_wt` `def_wt_uom` | Nullable fallback when `weight` is 0 |
| `inactive` | `inactive` | `boolean not null default false` |
| `discontinued` | `discontin` | `boolean not null default false` |
| `non_stock` | `non_stock` | `boolean not null default false` |
| `no_export` | `no_export` | `boolean not null default false` |
| `web_wholesale` | `webwholesale` | Shop visibility. `boolean not null default false` |
| `tax_category_code` | — (not dump) | Required by [`tax.md`](../../tax.md). Text code, **not** a percent. Nullable until catalog seed exists. |

**Not on `products`:** any on-hand / pick-list / on-order qty, `loc_onhand`, vendor name, PO dates, sales totals (already stated in the design doc).

---

## `catalog.products` — nullable stubs

| Column | Source | Stub rule |
| --- | --- | --- |
| `list_price_cents` | `lp_price` | Nullable integer cents. Staff may display later. Shop, cart, and `ProductSnapshot.unit_price` **must not** read this. |
| `web_retail` | `webretail` | `boolean not null default false`. No retail channel, no shop filter, no Shopify. |

Do not add a third price column.

---

## `catalog.products` — omit (deny-list)

| Dump field | Proposed paper name | Reason |
| --- | --- | --- |
| `item2` | `secondary_name` | Unverified; drop-if-unused |
| `original_wholesale_price` | `original_wholesale_price_cents` | Unverified history vs current |
| `c_to_c` | `carton_to_carton` | Unknown meaning |
| `line_comm` | `line_commission` | Flag vs amount unverified |
| `disc_over_sold` | `oversold_discount` | Unverified; conflicts with block-oversell |
| `disc_over_sold_percent` | `oversold_discount_bps` | Same |
| `onhand_qty` `loc_onhand` | — | Ledger / snapshot, not a product column |
| `onpicklist_qty` | — | Snapshot `allocated` |
| `on_order_qty` | — | Snapshot `on_order` |
| `v_on_order` | — | Unverified qty vs $; rebuild from POs if needed |
| `open_po_cnt` `next_po` `next_qty` | — | Report projections |
| `mtd_sales` `ytd_sales` `last_yr_sales` `all_sales` | — | Sales report queries |
| `vendor` `vendor_num` | — | `purchasing.suppliers` |
| `upcode` `mfg_code` `alt_code` `alt2_code` `alt3_code` | — | `catalog.product_identifiers` |
| `pkg_*` `ip_*` `cs_*` | — | `catalog.product_packaging` |
| `category_1` … `category_10` | — | `catalog.categories` + `product_categories` |
| `standard_cost` | `standard_cost_cents` | Valuation; out of v1 Accounting. Do not put it on `products`. |

`standard_cost` on `purchasing.supplier_products` is also **omitted** in Phase 0 (same valuation reason). `last_po_cost_cents` stays as a nullable convenience copy.

---

## Other dump-mapped tables — include (relocated)

These are not deny-list. Phase 0 creates the tables with the design-doc columns.

### `catalog.product_identifiers`

`product_id`, `kind` (`upc` \| `mfg` \| `alt`), `code`. Replaces the five dump code columns.

### `catalog.product_packaging`

One row per product. `pack_*`, `inner_pack_*`, `case_*` from `pkg_*` / `ip_*` / `cs_*`.

### `catalog.categories` + `catalog.product_categories`

Many-to-many tags. Do not create `category_1`…`category_10` columns.

### `catalog.product_images`

`product_id` + object-storage key / metadata. No bytes in Postgres.

### `purchasing.suppliers`

`id`, `vendor_number` (`vendor_num`), `name` (`vendor`).

### `purchasing.supplier_products`

`supplier_id`, `sku`, `supplier_sku` (often `mfg_code`), `min_order_qty`, `min_order_amount_cents`, `last_po_cost_cents` (nullable). **Omit** `standard_cost_cents`.

### `inventory.locations`

`id` (v1 ATP uses `DEFAULT`), `code` (`location`), `is_pick_bin` (`pickbin` as boolean, not a slot name). Named bins are not Phase 0.

### `inventory.reorder_policies`

`sku`, `location_id`, `min_on_hand`, `max_on_hand`.

### `inventory.stock_snapshots`

Read model only: `on_hand`, `allocated`, `on_order`. **`available` is not a writable dump column.** Whether it is a generated column or repository-only derivation is **out of scope** (still open on ADA-41).

---

## Identity: include `ops_users`

[`database-design.md`](../../database-design.md) ER has `staff_users`, `wholesale_users`, `sessions` only. [`stack.md`](../../stack.md) and [`licensing.md`](../../licensing.md) §9 require a third actor in Identity.

| Table | Phase 0 |
| --- | --- |
| `identity.staff_users` | Include (ER). Column list is the ER-only ticket, not this one. |
| `identity.wholesale_users` | Include (ER) + `customer_id`. |
| `identity.ops_users` | **Include.** One table for operator and business owner. |
| `identity.sessions` | Include. `actor_type` ∈ {`staff`, `wholesale`, `ops`} + `actor_id`. |

Minimum `ops_users` columns so the spec does not invent Better Auth:

| Column | Notes |
| --- | --- |
| `id` | UUID PK |
| `email` | Unique text |
| `kind` | `operator` \| `business_owner` |
| `tenant_id` | Text, `not null`, default `DEFAULT` |
| `created_at` `updated_at` | Timestamps |

Do **not** add password-hash, Better Auth `account`/`verification`, or a second `operator_users` table in Phase 0. Credentials stay Phase 1. Do **not** invent the staff RBAC matrix (invariants G8).

Licensing still holds `tenantId` on the subscription. Identity does not store plan prices.

---

## What this does not decide

- Column lists for ER-only contexts (customers, sales, accounting, licensing, operator_bridge, tax commit rows) — still open on ADA-41.
- `available` as a generated column vs derivation.
- Drizzle Kit home / `db:migrate` ([ADA-45](https://linear.app/adamhinckley/issue/ADA-45/drizzle-kit-home-and-dbmigrate)).
- Closing stakeholder call items as v1 law.

---

## Sources

- ADA-41 demo locks and “omit unverified dump-only columns”
- ADA-43 gist: catalog/inventory/purchasing have named columns; identity is ER-only and is missing ops users
- [`docs/database-design.md`](../../database-design.md) product grid + “open on the call”
- [`docs/stack.md`](../../stack.md) actor model
- [`docs/licensing.md`](../../licensing.md) §9
- [`docs/architecture.md`](../../architecture.md) X1 / K1
- [`product_browser_schema_glossary.csv`](../../../product_browser_schema_glossary.csv) (unverified)
