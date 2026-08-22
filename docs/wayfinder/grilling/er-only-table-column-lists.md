# ER-only table column lists

**Ticket:** [ADA-47](https://linear.app/adamhinckley/issue/ADA-47/er-only-table-column-lists)
**Kind:** grilling (demo-only lock for the Phase 0 spec)
**Map:** [ADA-41](https://linear.app/adamhinckley/issue/ADA-41/phase-0-implementation-spec-map)
**Blocked by:** [ADA-43](https://linear.app/adamhinckley/issue/ADA-43/schema-columns-on-paper-vs-er-only) (research), [ADA-44](https://linear.app/adamhinckley/issue/ADA-44/phase-0-column-deny-list-and-ops-users) (catalog deny-list + `ops_users`)
**Related:** [ADA-46](https://linear.app/adamhinckley/issue/ADA-46/available-generated-column-vs-repository-derivation) (`stock_snapshots.available` generated column — HITL 1; do not reopen)
**Not product law:** do not edit [`invariants.md`](../../invariants.md) §18 or tick [`open-questions.md`](../../open-questions.md)

---

## Decision

Phase 0 **lifts every column already named** in [`stack.md`](../../stack.md), [`tax.md`](../../tax.md), [`licensing.md`](../../licensing.md), [`operator-bridge.md`](../../operator-bridge.md), and the [`database-design.md`](../../database-design.md) relations list — plus the ADA-41 demo-lock fields (draft-order **status**; invoice **status** / **posted_at**).

It does **not** invent an RBAC matrix, Stripe objects, dump-only columns, document-number formats, or a full v1 schema for unnamed leftovers. Unnamed leftovers stay unspecified (additive later).

Catalog / relocated dump tables stay as [ADA-44](https://linear.app/adamhinckley/issue/ADA-44/phase-0-column-deny-list-and-ops-users). This ticket names the **ER-only and thin** tables.

---

## Must-settle

| Topic | Phase 0 |
| --- | --- |
| Skeleton depth | **Lift named columns.** PK + FKs + `created_at`/`updated_at` (or `created_at` only on append-only rows) **plus** every column already named in the companion docs and the relations list. Not PK/FK/timestamps only. Not a full invented v1 schema. |
| Line snapshots | **Typed columns**, not `JSONB`. `order_lines`: `sku`, `name`, `unit_price_cents`, `currency`, `tax_category_code`, `qty`. `purchase_order_lines`: `sku`, `name`, `qty`. |
| Draft-order status | `sales.orders.status` ∈ {`draft`, `confirmed`, `shipped`, `cancelled`}. Cart **is** a `draft` sales order (ADA-41). Does not close G5 (partial ship, empty/duplicate lines) as product law. |
| Invoice on ship | `accounting.invoices.status` ∈ {`unposted`, `posted`}; `posted_at` nullable timestamptz. Tax **commits** when the invoice posts. Does not close G7 as product law. |
| Tax vs invoice tax lines | **Keep both.** `tax.tax_commits` + `tax_commit_lines` = quote/commit/void + engine id. `accounting.invoice_tax_lines` = frozen copy; **no live FK** to tax tables. |
| `software_payments` | Lift [`licensing.md`](../../licensing.md) §7 exactly. No FK to AR. No Stripe types. |
| Operator bridge | Outbox **envelope columns** + closed `kind`. `issue_reports` status `new` → `queued` → `forwarded` \| `forward_failed`. |
| Staff / wholesale users | Minimum identity columns only. **No** Better Auth tables (Phase 1). **No** role / RBAC column (G8). `ops_users` already locked on ADA-44. |

---

## Policy (how to classify)

| Bucket | Meaning for the Phase 0 Drizzle skeleton |
| --- | --- |
| **Include** | Named column. Agent must persist it. Types follow stack: UUID PKs, `TEXT` SKU, `INTEGER` qty, `BIGINT` cents + `CHAR(3)` currency, timestamptz. |
| **Omit** | No column. Do not add “maybe later” booleans, Stripe objects, dump-only fields, or §18 inventions. |
| **Unspecified leftover** | Table exists; this attribute is not named in the allowed sources. **Do not invent it** in Phase 0. Additive migration later. |

Default timestamps: `created_at` + `updated_at` on mutable rows. Append-only facts (`stock_movements`, `software_payments`, `operator_outbox`) use `created_at` only unless a documented status field lives on the same row (`tax_commits.status`, `issue_reports.status`, `software_payments.status` → those keep `updated_at`).

Demo currency default is USD (ADA-44). Persist `currency` wherever `Money` is stored. Do not lock multi-currency as product law (G14).

---

## Identity

`identity.ops_users` is already locked ([ADA-44](https://linear.app/adamhinckley/issue/ADA-44/phase-0-column-deny-list-and-ops-users)): `id`, `email`, `kind` (`operator` \| `business_owner`), `tenant_id` default `DEFAULT`, timestamps. No Better Auth columns.

### `identity.staff_users`

| Column | Notes |
| --- | --- |
| `id` | UUID PK |
| `email` | Unique text |
| `created_at` `updated_at` | Timestamps |

**Omit:** `role` / permission bits (G8), password hash, Better Auth `account` / `verification`, display-name extras.

### `identity.wholesale_users`

| Column | Notes |
| --- | --- |
| `id` | UUID PK |
| `email` | Unique text |
| `customer_id` | UUID, not null, bound at login (relations list) |
| `created_at` `updated_at` | Timestamps |

**Omit:** password hash, Better Auth columns, a second `customer_id` the client may send.

### `identity.sessions`

| Column | Notes |
| --- | --- |
| `id` | UUID PK — opaque session id in the cookie |
| `actor_type` | `staff` \| `wholesale` \| `ops` (ADA-44) |
| `actor_id` | UUID of the matching user row |
| `created_at` `updated_at` | Timestamps |

**Omit:** JWT columns, refresh-token trees, CSRF tables. Cookie **names** (`staff_session`, …) are adapter config, not columns.

---

## Customers

Architecture U1 + [`tax.md`](../../tax.md) §5. Credit **formula** and terms **enum** stay §18 leftovers — the **fields** are named.

### `customers.customers`

| Column | Notes |
| --- | --- |
| `id` | UUID PK |
| `name` | Account label (Customers owns accounts) |
| `credit_limit_cents` | BIGINT, not null. Integer minor units. **Field** only; enforcement formula is G6. |
| `currency` | `CHAR(3)`, not null |
| `terms` | Text, not null. Do **not** add a Postgres enum of Net 30/60/90 (G13). |
| `created_at` `updated_at` | Timestamps |

**Omit:** AR balance as an editable column (U3), tax percent, dump-only profile fields, `account_number` format (unnamed).

### `customers.contacts`

| Column | Notes |
| --- | --- |
| `id` | UUID PK |
| `customer_id` | FK |
| `created_at` `updated_at` | Timestamps |

**Unspecified leftover:** name, email, phone, title. Do not invent a contact schema in Phase 0.

### `customers.ship_tos`

Default and extra addresses. Same typed address is **copied** onto `sales.orders` at write time (no live FK from the order).

| Column | Notes |
| --- | --- |
| `id` | UUID PK |
| `customer_id` | FK |
| `is_default` | `boolean not null default false` |
| `line_1` | Text, not null |
| `line_2` | Text, nullable |
| `city` | Text, not null |
| `region` | Text, not null (state / province) |
| `postal_code` | Text, not null |
| `country` | Text, not null (ISO 3166-1 alpha-2 when known) |
| `created_at` `updated_at` | Timestamps |

This is the `shipTo` snapshot [`tax.md`](../../tax.md) already requires on the tax document — typed columns, not JSONB.

### `customers.exemption_certificates`

| Column | Notes |
| --- | --- |
| `id` | UUID PK |
| `customer_id` | FK |
| `object_key` | Text, not null — bytes in object storage |
| `jurisdiction` | Text, not null |
| `entity_use_code` | Text, nullable — resale / entity-use code passed into `ITaxCalculator` |
| `expires_at` | Date, nullable |
| `status` | Text, not null — metadata only; **enforcement** is owner-gated |
| `created_at` `updated_at` | Timestamps |

**Omit:** CertCapture-class campaign columns, a rate, “this SKU is always 0%”.

---

## Inventory (thin): `stock_movements`

Read-model snapshots stay ADA-44 + ADA-46 (`on_hand`, `allocated`, `on_order`, `available` generated). This ticket names the **ledger**.

Movement **types** are locked in [`invariants.md`](../../invariants.md) §5 (not a §18 gap): `InboundFromPo`, `GoodsReceived`, `Allocated`, `Deallocated`, `Shipped`, `Adjustment`.

| Column | Notes |
| --- | --- |
| `id` | UUID PK |
| `sku` | Text, not null |
| `location_id` | UUID, not null — grain is `(sku, locationId)` (I10) |
| `movement_type` | Text + check (or enum) of the six locked types |
| `qty` | INTEGER, not null. Sign / uniqueness-key rules are G2/G3 leftovers — do not invent them. |
| `ref_type` | Text, not null — `purchase_order` \| `sales_order` (relations: PO or order) |
| `ref_id` | UUID, not null |
| `created_at` | Timestamptz, not null. Append-only fact; no `updated_at`. |

**Omit:** writable `available`, a second qty column, idempotency-key invention (G2), dump `onhand_qty`.

---

## Purchasing documents (thin)

`suppliers` / `supplier_products` stay ADA-44. **Do not** lift G9 PO statuses as product law.

### `purchasing.purchase_orders`

| Column | Notes |
| --- | --- |
| `id` | UUID PK |
| `supplier_id` | FK, not null |
| `created_at` `updated_at` | Timestamps |

**Unspecified leftover:** document number (G15), PO status machine (G9), PDF object key (`IFileStorage` is not wired in Phase 0).

### `purchasing.purchase_order_lines`

| Column | Notes |
| --- | --- |
| `id` | UUID PK |
| `purchase_order_id` | FK, not null |
| `sku` | Text, not null — frozen |
| `name` | Text, not null — frozen |
| `qty` | INTEGER, not null |
| `created_at` `updated_at` | Timestamps |

**Typed columns, not JSONB.** No live FK to `catalog.products`. **Omit:** unit cost on the line (`last_po_cost_cents` lives on `supplier_products`), `standard_cost`, JSON snapshot blob.

---

## Sales

### `sales.orders`

| Column | Notes |
| --- | --- |
| `id` | UUID PK |
| `customer_id` | UUID, not null — ID only, not a nested aggregate |
| `status` | `draft` \| `confirmed` \| `shipped` \| `cancelled`. **Demo:** cart = `draft`. |
| `ship_line_1` | Copied from `ship_tos` at write time |
| `ship_line_2` | Nullable |
| `ship_city` | |
| `ship_region` | |
| `ship_postal_code` | |
| `ship_country` | |
| `created_at` `updated_at` | Timestamps |

Last tax **quote** is informational and lives on `tax.tax_commits` (`status = quoted`, `order_id` set). Do **not** duplicate quote amounts on the order.

**Omit:** live `ship_to_id` FK (snapshot only), document number (G15), a separate `carts` table, credit-check result columns.

### `sales.order_lines`

| Column | Notes |
| --- | --- |
| `id` | UUID PK |
| `order_id` | FK, not null |
| `sku` | Text, not null — frozen |
| `name` | Text, not null — frozen |
| `qty` | INTEGER, not null |
| `unit_price_cents` | BIGINT, not null — **MP** (ADA-44). Shop / snapshot price. |
| `currency` | `CHAR(3)`, not null |
| `tax_category_code` | Text, not null — snapshot, not a percent |
| `created_at` `updated_at` | Timestamps |

**Typed columns, not JSONB.** No live FK to `catalog.products`. Do not read `list_price_cents`.

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
| `created_at` `updated_at` | Timestamps |

### `tax.tax_commit_lines`

| Column | Notes |
| --- | --- |
| `id` | UUID PK |
| `tax_commit_id` | FK, not null |
| `jurisdiction` | Text, not null |
| `tax_name` | Text, nullable — audit display |
| `rate_bps` | INTEGER, not null — display/audit, **never** multiply later |
| `taxable_base_cents` | BIGINT, not null |
| `tax_amount_cents` | BIGINT, not null — engine’s rounded `Money` |
| `currency` | `CHAR(3)`, not null |
| `created_at` | Timestamptz |

**Omit:** float rates, a `tax_percent` on products, SDK request dumps.

---

## Accounting

### `accounting.invoices`

| Column | Notes |
| --- | --- |
| `id` | UUID PK |
| `order_id` | UUID, not null — ER: one invoice may be created per order |
| `customer_id` | UUID, not null — denormalized for AR lists |
| `status` | `unposted` \| `posted`. **Demo:** invoice on **ship**; commit tax when it **posts**. |
| `posted_at` | Timestamptz, nullable — set when `posted` |
| `subtotal_cents` | BIGINT, not null |
| `tax_total_cents` | BIGINT, not null — committed tax, not a quote |
| `total_cents` | BIGINT, not null — includes tax |
| `currency` | `CHAR(3)`, not null |
| `created_at` `updated_at` | Timestamps |

**Omit:** due date / terms copy (G7 leftover), document number (G15), software-subscription amounts, a `tax_percent`.

### `accounting.invoice_tax_lines`

Frozen copy of **committed** lines. Never recomputed. **No live FK** to `tax.tax_commits` / `tax_commit_lines`.

| Column | Notes |
| --- | --- |
| `id` | UUID PK |
| `invoice_id` | FK, not null |
| `jurisdiction` | Text, not null |
| `tax_name` | Text, nullable |
| `rate_bps` | INTEGER, not null |
| `taxable_base_cents` | BIGINT, not null |
| `tax_amount_cents` | BIGINT, not null |
| `currency` | `CHAR(3)`, not null |
| `created_at` | Timestamptz |

### `accounting.payments`

| Column | Notes |
| --- | --- |
| `id` | UUID PK |
| `customer_id` | FK, not null |
| `amount_cents` | BIGINT, not null |
| `currency` | `CHAR(3)`, not null |
| `created_at` `updated_at` | Timestamps |

**Omit:** card PAN, Stripe PaymentIntent columns, software-payment mix-in (L1). Application **rules** are G10 leftovers.

### `accounting.payment_applications`

| Column | Notes |
| --- | --- |
| `id` | UUID PK |
| `payment_id` | FK, not null |
| `invoice_id` | FK, not null |
| `amount_cents` | BIGINT, not null — partial pay allowed by the ER |
| `currency` | `CHAR(3)`, not null |
| `created_at` | Timestamptz |

---

## Licensing

Do **not** invent the `FeatureName` catalog or Stripe Customer/Subscription/Price rows. Provider ids are **opaque strings**.

### `licensing.subscriptions`

| Column | Notes |
| --- | --- |
| `id` | UUID PK |
| `tenant_id` | Text, not null, default `DEFAULT` |
| `plan` | Text, not null — label; not a paid-pack catalog |
| `status` | `trialing` \| `active` \| `past_due` \| `canceled` |
| `period_start` `period_end` | Timestamptz, nullable |
| `provider_ref` | Text, nullable — opaque billing-provider id, **not** a Stripe type |
| `created_at` `updated_at` | Timestamps |

### `licensing.add_on_grants`

| Column | Notes |
| --- | --- |
| `id` | UUID PK |
| `subscription_id` | FK, not null |
| `add_on_id` | UUID, not null |
| `source` | `purchased` \| `complementary` |
| `created_at` `updated_at` | Timestamps |

### `licensing.software_payments`

Lift of [`licensing.md`](../../licensing.md) §7. Append-only history. **Not** `accounting.payments`.

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
| `created_at` `updated_at` | Status is a documented field (L2), not a silent delete |

**Omit:** Stripe Event/Customer/Price objects, PAN, FK to a wholesale invoice.

### `licensing.flag_overrides`

| Column | Notes |
| --- | --- |
| `id` | UUID PK |
| `subscription_id` | FK, not null |
| `feature_name` | Text, not null — must already exist in the Licensing catalog; agents do not invent strings |
| `direction` | `force_on` \| `force_off` |
| `created_at` `updated_at` | Timestamps |

---

## Operator bridge

### `operator_bridge.issue_reports`

Saved **here first**. User success does not depend on publish.

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
| `created_at` `updated_at` | Timestamps |

**Omit:** ticket thread, SLA, screenshot object key (optional later), wholesale-customer PII, order lines.

### `operator_bridge.operator_outbox`

Envelope from [`operator-bridge.md`](../../operator-bridge.md) §4. `payload` is the one Phase 0 `JSONB` — it is the versioned per-kind body, **not** a product snapshot.

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
| `created_at` | Timestamptz, not null |

**Omit:** invented kinds (`order.placed`, ATP), Stripe objects inside `payload`, Kafka/outbox-for-inventory.

---

## Why typed snapshots (not JSONB)

[`stack.md`](../../stack.md) allows “columns, or JSONB for a frozen ProductSnapshot.” Phase 0 picks **columns**:

- The relations list already names `sku` / `name` / `unit_price` / `tax_category_code`.
- `Money` must be `BIGINT` cents + `currency` (T1). A JSON number invites float.
- Agents invent extra snapshot keys inside a blob; they cannot invent a column the spec omitted.
- ADA-44 already said order lines snapshot **MP** as a typed amount.

`operator_outbox.payload` stays `JSONB` because the envelope’s `payload` is explicitly `unknown` and versioned per closed `kind`.

---

## Explicitly do not invent (Phase 0)

| Temptation | Why omitted |
| --- | --- |
| Staff `role` / permission CMS | G8 — owner matrix later |
| Better Auth `user` / `account` / `verification` | Phase 1 |
| Stripe Customer / Subscription / Price / Event columns | Opaque `provider_ref` only |
| `document_number` on PO / order / invoice | G15 |
| PO status machine | G9 |
| Invoice due date / terms copy | G7 |
| Credit-limit **formula** columns | G6 — field exists, formula does not |
| Movement unique `(ref_type, ref_id, sku, movement_type)` | G2 — columns exist; constraint is leftover |
| Adjustment sign / negative stock | G3 |
| Dump-only catalog fields | ADA-44 deny-list |
| `available` as writable | ADA-46 — generated column |
| Separate `carts` table | Demo lock: cart = draft order |
| `tax_quotes` table besides `tax_commits` | One table, `status` |
| Merging `invoice_tax_lines` into tax | Frozen AR copy; no live FK |
| Operator-platform message kinds beyond the four | B3 |

---

## What this does not decide

- Drizzle Kit home / `pnpm db:migrate` ([ADA-45](https://linear.app/adamhinckley/issue/ADA-45/drizzle-kit-home-and-dbmigrate)).
- `.env.example` vs docs-only `DATABASE_URL` ([ADA-48](https://linear.app/adamhinckley/issue/ADA-48/envexample-vs-database-url-docs-only)).
- CI migrate vs local-only stop ([ADA-49](https://linear.app/adamhinckley/issue/ADA-49/ci-migrate-vs-local-only-stop-condition)).
- Writing `docs/demo-assumptions.md`, compose, or migrations (work after the Phase 0 spec exists).
- Closing stakeholder call items as v1 law.

---

## Sources

- ADA-41 demo locks: invoice on ship; cart = draft sales order; omit unverified dump-only columns
- ADA-43: identity / customers / sales / accounting / tax / licensing / operator_bridge are ER-only; movements + PO documents are thin
- ADA-44: catalog deny-list; `ops_users`; MP snapshot price
- ADA-46 HITL: `available` generated column
- [`docs/database-design.md`](../../database-design.md) relations + “intentionally not a live FK”
- [`docs/stack.md`](../../stack.md) money / qty / session / snapshot fork
- [`docs/tax.md`](../../tax.md) quote/commit/void + certificate metadata + invoice totals
- [`docs/licensing.md`](../../licensing.md) §4 aggregates + §7 `software_payments`
- [`docs/operator-bridge.md`](../../operator-bridge.md) envelope + issue status machine
- [`docs/invariants.md`](../../invariants.md) §5 movement types, C2/O2/P3 snapshots, L2, B3 — **not** §18
