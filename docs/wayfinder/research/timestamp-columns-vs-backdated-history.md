---
title: "Timestamp columns vs backdated history"
tags: [wayfinder, research]
status: active
created: 2026-08-24
---

# Timestamp columns vs backdated history

Ticket: [ADA-116](https://linear.app/adamhinckley/issue/ADA-116/timestamp-columns-vs-backdated-history).

Sources in this repo (working tree used for the column inventory; this note lives on `research/timestamp-columns-vs-backdated-history`):

- Drizzle: `apps/api/src/infrastructure/schema/*.ts`
- Kit SQL: `apps/api/drizzle/migrations/0000_catalog_purchasing_inventory.sql`, `apps/api/drizzle/migrations/0001_identity_customers_sales_tax_accounting.sql`
- Tests: `tests/phase0-catalog-inventory-schema.test.ts`, `tests/phase0-er-lift-schema.test.ts`
- Docs quotes: `docs/invariants.md` §18 (G7, G13, G15)

## Question

Can the current schema **backdate** ~5 years of documents and movements, or is every timestamp `now()`?

## What the migrations declare

Two additive Kit migrations. Time columns are `timestamp with time zone`. Drizzle `defaultNow()` compiles to `DEFAULT now()`.

Neither SQL file contains `CREATE TRIGGER`. The only `GENERATED ALWAYS` column is `inventory.stock_snapshots.available` (`on_hand - allocated`), not a time column.

`created_at` and `updated_at` (where present) are `NOT NULL` with `DEFAULT now()`. That default applies when an `INSERT` omits the column. The columns are ordinary writable timestamptz fields, not `GENERATED ALWAYS`.

`updated_at` uses the same insert default. The migrations do not set `updated_at` on `UPDATE`.

No application use case inserts into the tables below. There is no Drizzle `.insert(` under `apps/api/src`. `IClock` is wired for `PingUseCase` only (`apps/api/src/domain/clock.ts`, `apps/api/src/application/ping.ts`).

## Table → columns

| Table | Time / terms columns | Default | Used by any use case or test today |
|---|---|---|---|
| `inventory.stock_movements` | `created_at` timestamptz `NOT NULL`. No `updated_at`. No `occurred_at`. | `defaultNow()` / `DEFAULT now()` | `tests/phase0-catalog-inventory-schema.test.ts` asserts the table and movement enums. No use case writes rows. |
| `inventory.stock_snapshots` | `created_at`, `updated_at` | both `defaultNow()` | Same test (generated `available`). No use case writes rows. |
| `inventory.reorder_policies` | `created_at`, `updated_at` | both `defaultNow()` | Same test (`min_on_hand`, `max_on_hand`). No use case writes rows. |
| `inventory.locations` | `created_at`, `updated_at` | both `defaultNow()` | Same test (`is_pick_bin`). No use case writes rows. |
| `purchasing.purchase_orders` | `created_at`, `updated_at`. No document-number column. Comment in `purchasing.ts`: “Thin PO header — no document number, no G9 status machine.” | both `defaultNow()` | Same test: thin POs; migration SQL `not.toMatch(/document_number\|po_status\|g9/i)`. No use case writes rows. |
| `purchasing.purchase_order_lines` | `created_at`, `updated_at` | both `defaultNow()` | Same test (frozen sku/name/qty). No use case writes rows. |
| `sales.orders` | `created_at`, `updated_at`. No document-number column. | both `defaultNow()` | `tests/phase0-er-lift-schema.test.ts` asserts statuses and ship snapshot columns; `expect(sql).not.toMatch(/document_number/)`. No use case writes rows. |
| `sales.order_lines` | `created_at`, `updated_at` | both `defaultNow()` | Same ER-lift test. No use case writes rows. |
| `accounting.invoices` | `posted_at` timestamptz, nullable, no default; `created_at`, `updated_at`. No `due_date`. No document-number column. | `posted_at`: none; timestamps: `defaultNow()` | ER-lift test expects `posted_at` and `expect(sql).not.toMatch(/due_date/)`. Invented leftover list includes `"due_date"` and `"document_number"` (must not appear as quoted identifiers in schema TS). No use case writes rows. |
| `accounting.invoice_tax_lines` | `created_at`, `updated_at` | both `defaultNow()` | Same test (frozen tax lines). No use case writes rows. |
| `accounting.payments` | `created_at`, `updated_at`. No `occurred_at`. | both `defaultNow()` | Same test. No use case writes rows. |
| `accounting.payment_applications` | `created_at`, `updated_at` | both `defaultNow()` | Same test. No use case writes rows. |
| `customers.customers` | `terms` **text `NOT NULL`** (not a timestamp); `created_at`, `updated_at`. No Postgres enum for terms. | timestamps: `defaultNow()`; `terms`: no SQL default | ER-lift test expects `"terms" text` and `not.toMatch(/CREATE TYPE .*"terms"/i)`. Schema comment: “Terms are free text (G6 stays open).” No use case writes rows. |
| `catalog.products` | `created_at`, `updated_at` | both `defaultNow()` | Catalog schema test asserts product columns. Stub `GET /internal/products` lists `createdAt` as an `x-table` **sort** field (`apps/api/src/schemas.ts`); `productListItemSchema` has no `createdAt` property; the handler returns `emptyProductList`. No use case reads or writes `catalog.products`. |

### Names the ticket asked about that are not columns

| Name | In Kit schema? |
|---|---|
| `occurred_at` | No table in the two migrations. `docs/licensing.md` names it as a conceptual column on `licensing.software_payments`, which is not migrated here. |
| `due_date` | Absent. ER-lift test forbids `due_date` in migration SQL. |
| `document_number` / G15 | Absent. Purchasing and sales schema tests forbid `document_number` in SQL; leftover list forbids it in schema TS. |

Also present but not on the ticket’s required list: `customers.exemption_certificates.expires_at` (timestamptz, nullable, no default).

## Docs: invoice due date and terms (not columns)

`docs/invariants.md` §18 G7:

> Due date = invoice date + customer terms (Net 30/60/90), copied onto the invoice so later terms edits do not rewrite history — stakeholder language already assumes this.

`docs/invariants.md` §18 G13:

> The architecture Customers context is accounts, contacts, terms, credit. Stakeholder tables also have **`customer_ship_to`**, **invoice due-from-terms**, **statements**, and **confirm = page + matching email**.

G13 suggested default (still §18, not a column): “Terms enum \| Net 30/60/90 is the AR clock \| Enum on customer; copied to invoice”.

`docs/invariants.md` §18 G15:

> each of PO, sales order, invoice has a unique **document number** (opaque sequence or `YYYY-#####`) assigned in the context that owns the aggregate. UUID remains the primary key. Snapshot the number onto PDFs.

Implemented `customers.customers.terms` is free text, not that enum, and invoices have no due-date or document-number column.

## Direct answer

Kit `created_at` / `updated_at` columns default to `now()` (`defaultNow()`). `inventory.stock_movements` has only `created_at` with that default. `accounting.invoices.posted_at` is nullable with no default. There is no `due_date` or `occurred_at` on the listed business tables, and no G15 document-number column. No use case writes those rows today. Tests lock the shape, including the absence of `due_date` and `document_number`. Invoice due-date-from-terms is `docs/invariants.md` text, not a column.
