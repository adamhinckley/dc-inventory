# ER-only table column lists

**Ticket:** [ER-only table column lists](https://linear.app/adamhinckley/issue/ADA-47/er-only-table-column-lists)
**Kind:** grilling (demo-only lock for the Phase 0 spec)
**Map:** [Phase 0 implementation spec map](https://linear.app/adamhinckley/issue/ADA-41/phase-0-implementation-spec-map)
**HITL:** Cursor thread [bc-034a998a](https://www.cursor.com/agents/bc-034a998a-a731-4756-9e29-e54099c8e992) (Q1–Q7 answered there)
**Not product law:** do not edit [`invariants.md`](../../invariants.md) §18 or tick [`open-questions.md`](../../open-questions.md)

Do **not** treat [PR 31](https://github.com/adamhinckley/dc-inventory/pull/31) / `cursor/er-only-table-column-lists-a23c` as canonical. That session closed the ticket without Q2–Q7 in this HITL thread (same conflict class as PR 30 on `available`).

This note does not add Drizzle tables, compose, or SQL.

---

## HITL

| Q | Pick | Lock |
| --- | --- | --- |
| 1 Skeleton depth | **1** | Lift named columns. Not PK/FK-only. Not an invented full v1 schema. |
| 2 Line / address snapshots | **1** | **Typed columns**, not `JSONB` (except outbox `payload`, which is the message body). |
| 3 Draft order + invoice on ship | **1** | Demo statuses below. Do not close G5/G7 in §18. |
| 4 Tax vs invoice tax lines | **1** | Keep **both**: `tax_commits` + lines, and frozen `invoice_tax_lines` (no live FK). |
| 5 `software_payments` | **1** + note | Lift [`licensing.md`](../../licensing.md) §7. **Persist in Postgres; do not surface in UI** for this demo. |
| 6 Outbox + issue reports | **1** | Lift envelope + closed kinds; issue status `new` → `queued` → `forwarded` \| `forward_failed`. |
| 7 Staff / wholesale users | **1** | Min columns. No Better Auth. No RBAC. `ops_users` stays [Phase 0 column deny-list and ops users](https://linear.app/adamhinckley/issue/ADA-44/phase-0-column-deny-list-and-ops-users). |

---

## Decision

Phase 0 **names PK, FKs, timestamps, plus every column already named** in [`stack.md`](../../stack.md), [`tax.md`](../../tax.md), [`licensing.md`](../../licensing.md), [`operator-bridge.md`](../../operator-bridge.md), and the [`database-design.md`](../../database-design.md) relations list, plus the ADA-41 demo-lock fields.

It does **not** invent an RBAC matrix, Stripe objects, dump-only columns, document-number formats, or a full v1 schema for unnamed leftovers. Unnamed leftovers stay unspecified (additive later).

Catalog / relocated dump tables stay as ADA-44. [available generated column vs repository derivation](https://linear.app/adamhinckley/issue/ADA-46/available-generated-column-vs-repository-derivation) already locked `stock_snapshots.available` as a generated column (HITL 1).

---

## Policy

| Bucket | Meaning for the Phase 0 Drizzle skeleton |
| --- | --- |
| **Include** | Named column. Agent must persist it. Types: UUID PKs, `TEXT` SKU, `INTEGER` qty, `BIGINT` cents + `CHAR(3)` currency, timestamptz. |
| **Omit** | No column. No “maybe later” booleans, Stripe objects, dump-only fields, or §18 inventions. |
| **Unspecified leftover** | Table exists; attribute not named in allowed sources. **Do not invent** in Phase 0. |

Default timestamps: `created_at` + `updated_at` on mutable rows. Append-only facts (`stock_movements`, `operator_outbox`) use `created_at` only unless a documented status field lives on the row (`tax_commits.status`, `issue_reports.status`, `software_payments.status` keep `updated_at`).

Demo currency default is USD (ADA-44). Persist `currency` wherever `Money` is stored. Do not lock multi-currency as product law (G14).

---

## Identity

`identity.ops_users` (ADA-44): `id`, `email`, `kind` (`operator` \| `business_owner`), `tenant_id` default `DEFAULT`, timestamps. No Better Auth columns.

### `identity.staff_users`

| Column | Notes |
| --- | --- |
| `id` | UUID PK |
| `email` | Unique text |
| `created_at` `updated_at` | |

**Omit:** `role` / permission bits (G8), password hash, Better Auth `account` / `verification`.

### `identity.wholesale_users`

| Column | Notes |
| --- | --- |
| `id` | UUID PK |
| `email` | Unique text |
| `customer_id` | UUID, not null — bound at login |
| `created_at` `updated_at` | |

**Omit:** password hash, Better Auth columns.

### `identity.sessions`

| Column | Notes |
| --- | --- |
| `id` | UUID PK — opaque session id in the cookie |
| `actor_type` | `staff` \| `wholesale` \| `ops` (ADA-44) |
| `actor_id` | UUID of the matching user row |
| `created_at` `updated_at` | |

**Omit:** JWT columns, cookie **names** (adapter config, not columns).

---

## Customers

U1 + [`tax.md`](../../tax.md) §5. Credit **formula** and terms **enum** stay §18 — the **fields** are named.

### `customers.customers`

| Column | Notes |
| --- | --- |
| `id` | UUID PK |
| `name` | Account label |
| `credit_limit_cents` | BIGINT, not null. **Field** only; enforcement is G6. |
| `currency` | `CHAR(3)`, not null |
| `terms` | Text, not null. Do **not** add a Postgres enum of Net 30/60/90 (G13). |
| `created_at` `updated_at` | |

**Omit:** editable AR balance (U3), tax percent, `account_number` format.

### `customers.contacts`

| Column | Notes |
| --- | --- |
| `id` | UUID PK |
| `customer_id` | FK |
| `created_at` `updated_at` | |

**Unspecified leftover:** name, email, phone, title. Do not invent a contact schema in Phase 0.

### `customers.ship_tos`

Typed address (HITL Q2). Same shape is **copied** onto `sales.orders` (no live FK from the order). This is the `shipTo` snapshot tax already requires.

| Column | Notes |
| --- | --- |
| `id` | UUID PK |
| `customer_id` | FK |
| `is_default` | `boolean not null default false` |
| `line_1` | Text, not null |
| `line_2` | Text, nullable |
| `city` | Text, not null |
| `region` | Text, not null |
| `postal_code` | Text, not null |
| `country` | Text, not null |
| `created_at` `updated_at` | |

### `customers.exemption_certificates`

| Column | Notes |
| --- | --- |
| `id` | UUID PK |
| `customer_id` | FK |
| `object_key` | Text, not null — bytes in object storage |
| `jurisdiction` | Text, not null |
| `entity_use_code` | Text, nullable |
| `expires_at` | Date, nullable |
| `status` | Text, not null — metadata; enforcement is owner-gated |
| `created_at` `updated_at` | |

**Omit:** “this SKU is always 0%”, certificate-lifecycle CMS.

---

## Inventory (thin): `stock_movements`

Snapshots stay ADA-44 + ADA-46. Movement **types** are locked in [`invariants.md`](../../invariants.md) §5 (not a §18 gap): `InboundFromPo`, `GoodsReceived`, `Allocated`, `Deallocated`, `Shipped`, `Adjustment`.

| Column | Notes |
| --- | --- |
| `id` | UUID PK |
| `sku` | Text, not null |
| `location_id` | UUID, not null — grain `(sku, locationId)` (I10) |
| `movement_type` | The six locked types |
| `qty` | INTEGER, not null. Sign / uniqueness-key rules are G2/G3 leftovers. |
| `ref_type` | `purchase_order` \| `sales_order` |
| `ref_id` | UUID, not null |
| `created_at` | Append-only; no `updated_at` |

**Omit:** writable `available`, dump `onhand_qty`.

---

## Purchasing documents (thin)

`suppliers` / `supplier_products` stay ADA-44. **Do not** lift G9 PO statuses as product law.

### `purchasing.purchase_orders`

| Column | Notes |
| --- | --- |
| `id` | UUID PK |
| `supplier_id` | FK, not null |
| `created_at` `updated_at` | |

**Unspecified leftover:** document number (G15), PO status machine (G9), PDF object key (`IFileStorage` not wired in Phase 0).

### `purchasing.purchase_order_lines`

Typed columns, not JSONB. Frozen **sku / name**. No live FK to `catalog.products`.

| Column | Notes |
| --- | --- |
| `id` | UUID PK |
| `purchase_order_id` | FK, not null |
| `sku` | Text, not null |
| `name` | Text, not null |
| `qty` | INTEGER, not null |
| `created_at` `updated_at` | |

**Omit:** unit cost on the line (`last_po_cost_cents` is on `supplier_products`), JSON snapshot blob.

---

## Sales

### `sales.orders`

Demo (HITL Q3, not G5 law): `status` ∈ {`draft`, `confirmed`, `shipped`, `cancelled`}. Cart **is** `draft`.

| Column | Notes |
| --- | --- |
| `id` | UUID PK |
| `customer_id` | UUID, not null |
| `status` | `draft` \| `confirmed` \| `shipped` \| `cancelled` |
| `ship_line_1` `ship_line_2` `ship_city` `ship_region` `ship_postal_code` `ship_country` | Copied from `ship_tos` at write time |
| `created_at` `updated_at` | |

Last tax **quote** lives on `tax.tax_commits` (`status = quoted`, `order_id` set). Do not duplicate quote amounts on the order.

**Omit:** live `ship_to_id` FK, document number (G15), a separate `carts` table.

### `sales.order_lines`

Typed columns, not JSONB. Snapshot price is **MP** (ADA-44).

| Column | Notes |
| --- | --- |
| `id` | UUID PK |
| `order_id` | FK, not null |
| `sku` `name` | Frozen text |
| `qty` | INTEGER, not null |
| `unit_price_cents` | BIGINT, not null — MP |
| `currency` | `CHAR(3)`, not null |
| `tax_category_code` | Text, not null — not a percent |
| `created_at` `updated_at` | |

---

## Tax

Checkout **quotes**; invoice **post** **commits**. Stock allocate and tax HTTP are not one transaction.

### `tax.tax_commits`

| Column | Notes |
| --- | --- |
| `id` | UUID PK |
| `order_id` | UUID, nullable — set on quote |
| `invoice_id` | UUID, nullable — set on commit |
| `engine_transaction_id` | Text, nullable — present on commit |
| `status` | `quoted` \| `committed` \| `voided` |
| `created_at` `updated_at` | |

### `tax.tax_commit_lines`

| Column | Notes |
| --- | --- |
| `id` | UUID PK |
| `tax_commit_id` | FK, not null |
| `jurisdiction` | Text, not null |
| `tax_name` | Text, nullable |
| `rate_bps` | INTEGER, not null — display/audit, **never** multiply later |
| `taxable_base_cents` | BIGINT, not null |
| `tax_amount_cents` | BIGINT, not null — engine’s rounded `Money` |
| `currency` | `CHAR(3)`, not null |
| `created_at` | |

**Omit:** float rates, `tax_percent` on products.

---

## Accounting

### `accounting.invoices`

Demo (HITL Q3, not G7 law): invoice on **ship**; tax commits when it **posts**.

| Column | Notes |
| --- | --- |
| `id` | UUID PK |
| `order_id` | UUID, not null — one invoice may be created per order |
| `customer_id` | UUID, not null |
| `status` | `unposted` \| `posted` |
| `posted_at` | Timestamptz, nullable — set when `posted` |
| `subtotal_cents` `tax_total_cents` `total_cents` | BIGINT, not null. `total` includes committed tax |
| `currency` | `CHAR(3)`, not null |
| `created_at` `updated_at` | |

**Omit:** due date / terms copy (G7 leftover), document number (G15), software-subscription amounts.

### `accounting.invoice_tax_lines`

Frozen copy of **committed** lines. Never recomputed. **No live FK** to `tax.*`.

| Column | Notes |
| --- | --- |
| `id` | UUID PK |
| `invoice_id` | FK, not null |
| `jurisdiction` `tax_name` `rate_bps` `taxable_base_cents` `tax_amount_cents` `currency` | Same shape as `tax_commit_lines` |
| `created_at` | |

### `accounting.payments`

| Column | Notes |
| --- | --- |
| `id` | UUID PK |
| `customer_id` | FK, not null |
| `amount_cents` | BIGINT, not null |
| `currency` | `CHAR(3)`, not null |
| `created_at` `updated_at` | |

**Omit:** card PAN, Stripe PaymentIntent columns, mix-in of `software_payments`.

### `accounting.payment_applications`

| Column | Notes |
| --- | --- |
| `id` | UUID PK |
| `payment_id` `invoice_id` | FKs, not null |
| `amount_cents` | BIGINT, not null — partial pay allowed by the ER |
| `currency` | `CHAR(3)`, not null |
| `created_at` | |

---

## Licensing

Provider ids are **opaque strings**, not Stripe types. Do not invent the `FeatureName` catalog in this ticket.

### `licensing.subscriptions`

| Column | Notes |
| --- | --- |
| `id` | UUID PK |
| `tenant_id` | Text, not null, default `DEFAULT` |
| `plan` | Text, not null |
| `status` | `trialing` \| `active` \| `past_due` \| `canceled` |
| `period_start` `period_end` | Timestamptz, nullable |
| `provider_ref` | Text, nullable — opaque |
| `created_at` `updated_at` | |

### `licensing.add_on_grants`

| Column | Notes |
| --- | --- |
| `id` | UUID PK |
| `subscription_id` | FK, not null |
| `add_on_id` | UUID, not null |
| `source` | `purchased` \| `complementary` |
| `created_at` `updated_at` | |

### `licensing.software_payments`

Lift of [`licensing.md`](../../licensing.md) §7. Append-only. **Not** `accounting.payments`.

**Demo UI:** persist this table. **Do not** add ops (or any) payment-history screens in this demo. Manual record / Stripe adapter / `/ops` list stay later phases.

| Column | Notes |
| --- | --- |
| `id` | UUID PK |
| `tenant_id` | Text, not null |
| `subscription_id` | FK, not null |
| `amount_cents` | BIGINT, not null |
| `currency` | `CHAR(3)`, not null |
| `status` | `pending` \| `succeeded` \| `failed` \| `refunded` |
| `kind` | `subscription` \| `add_on` \| `manual` |
| `occurred_at` | Timestamptz, not null |
| `provider` | `stripe` \| `manual` |
| `provider_ref` | Text, nullable, **unique when present** |
| `memo` | Text, nullable |
| `created_at` `updated_at` | Status is a documented field (L2) |

**Omit:** Stripe Event/Customer/Price objects, PAN, FK to a wholesale invoice.

### `licensing.flag_overrides`

| Column | Notes |
| --- | --- |
| `id` | UUID PK |
| `subscription_id` | FK, not null |
| `feature_name` | Text, not null — must already exist in the Licensing catalog |
| `direction` | `force_on` \| `force_off` |
| `created_at` `updated_at` | |

---

## Operator bridge

Phase 0 still uses **no-op** `IOperatorPlatform`. Tables exist so facts are not lost.

### `operator_bridge.issue_reports`

| Column | Notes |
| --- | --- |
| `id` | UUID PK — local `issue_id` |
| `summary` | Text, not null |
| `details` | Text, nullable |
| `actor_type` | `staff` \| `ops` \| `wholesale` |
| `surface` | `internal` \| `ops` \| `wholesale` |
| `request_id` | Text, nullable |
| `release_sha` | Text, nullable |
| `status` | `new` → `queued` → `forwarded` \| `forward_failed` |
| `created_at` `updated_at` | |

**Omit:** ticket thread, SLA, wholesale PII, order lines.

### `operator_bridge.operator_outbox`

Envelope from [`operator-bridge.md`](../../operator-bridge.md) §4. `payload` is the one Phase 0 `JSONB` — versioned per closed `kind`, **not** a product snapshot.

| Column | Notes |
| --- | --- |
| `id` | UUID PK |
| `product_code` | Text, not null — `dc-inventory` |
| `installation_id` | UUID, not null |
| `tenant_id` | Text, not null |
| `occurred_at` | Timestamptz, not null |
| `idempotency_key` | Text, not null, **unique** |
| `kind` | `license.snapshot` \| `income.recorded` \| `issue.reported` \| `heartbeat` |
| `payload` | `JSONB`, not null — no PAN, no session tokens, no wholesale PII, no order lines / ATP |
| `created_at` | |

**Omit:** invented kinds (`order.placed`), Kafka, inventory outbox.

---

## Explicitly do not invent (Phase 0)

| Temptation | Why omitted |
| --- | --- |
| Staff `role` / permission CMS | G8; HITL Q7 |
| Better Auth tables | Phase 1; HITL Q7 |
| Stripe Customer / Subscription / Price / Event columns | Opaque `provider_ref` only; HITL Q5 |
| Ops (or any) software-payment **UI** | HITL Q5 extra lock — table yes, screen no |
| `document_number` | G15 |
| PO status machine | G9 |
| Invoice due date / terms copy | G7 leftover |
| Credit-limit **formula** columns | G6 |
| Separate `carts` table | Demo: cart = draft order |
| Merging `invoice_tax_lines` into tax | HITL Q4 — frozen copy, no live FK |
| Extra operator-platform kinds | B3; HITL Q6 |
| Dump-only catalog fields | ADA-44 |
| Writable `available` | ADA-46 generated column |

---

## What this does not decide

- [CI migrate vs local-only stop condition](https://linear.app/adamhinckley/issue/ADA-49/ci-migrate-vs-local-only-stop-condition)
- [`.env.example` vs DATABASE_URL docs only](https://linear.app/adamhinckley/issue/ADA-48/envexample-vs-database-url-docs-only)
- Writing `docs/demo-assumptions.md`, compose, or migrations (after the Phase 0 spec exists)
- Closing stakeholder call items as v1 law
