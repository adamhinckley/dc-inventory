# Database design — table relations (rough draft)

> **Rough draft — not a locked schema.**  
> Starting point for stakeholder review. Use this on a call to confirm how tables connect.

One Postgres database · schema per context · inventory is the only place quantities are written.

Related: [`architecture.md`](./architecture.md) · [`stack.md`](./stack.md) · [`tax.md`](./tax.md) · [`invariants.md`](./invariants.md) (locked rules; open call items expanded there) · [`licensing.md`](./licensing.md) (software subscription tables are operator-facing)

---

## Big picture

```mermaid
flowchart LR
  subgraph identity["identity"]
    staff_users
    wholesale_users
    sessions
  end

  subgraph catalog["catalog"]
    products
    product_images
  end

  subgraph customers["customers"]
    customers_t["customers"]
    contacts
    ship_tos["ship_tos"]
    exemption_certificates
  end

  subgraph tax["tax"]
    tax_commits
    tax_commit_lines
  end

  subgraph inventory["inventory · core"]
    stock_movements
    stock_snapshots
  end

  subgraph purchasing["purchasing"]
    suppliers
    purchase_orders
    purchase_order_lines
  end

  subgraph sales["sales"]
    orders
    order_lines
  end

  subgraph accounting["accounting"]
    invoices
    invoice_tax_lines
    payments
    payment_applications
  end

  subgraph licensing["licensing · software"]
    subscriptions
    add_on_grants
    software_payments
    flag_overrides
  end

  subgraph operator_bridge["operator_bridge · door"]
    issue_reports
    operator_outbox
  end

  wholesale_users -->|customer_id| customers_t
  staff_users --> sessions
  wholesale_users --> sessions

  products --> product_images
  products -.->|sku snapshot| purchase_order_lines
  products -.->|sku + price + taxCategory snapshot| order_lines
  products -.->|taxCategoryCode| tax_commits

  suppliers --> purchase_orders
  purchase_orders --> purchase_order_lines
  purchase_orders -->|movements| stock_movements

  customers_t --> contacts
  customers_t --> ship_tos
  customers_t --> exemption_certificates
  customers_t --> orders
  ship_tos -.->|address snapshot| orders
  exemption_certificates -.->|exemption snapshot| tax_commits
  orders --> order_lines
  orders -->|allocate / ship| stock_movements
  orders -->|quote| tax_commits
  stock_movements --> stock_snapshots

  orders --> invoices
  invoices -->|commit| tax_commits
  tax_commits --> tax_commit_lines
  tax_commit_lines -.->|frozen copy| invoice_tax_lines
  invoices --> invoice_tax_lines
  customers_t --> invoices
  customers_t --> payments
  payments --> payment_applications
  invoices --> payment_applications

  subscriptions --> add_on_grants
  subscriptions --> software_payments
  subscriptions --> flag_overrides
  software_payments -.->|after commit| operator_outbox
  issue_reports --> operator_outbox
```

**Happy path (wholesale):** product → purchase order received → client order (tax **quoted**) → stock allocates → invoice (tax **committed**) & payment.

**Happy path (software):** tenant subscribes → payment to the developer recorded → add-on grant → `IFeatures` flips. Not the same tables as customer AR.

---

## Entity relationships

```mermaid
erDiagram
  customers ||--o{ wholesale_users : "has logins"
  customers ||--o{ contacts : "has"
  customers ||--o{ ship_tos : "ships to"
  customers ||--o{ exemption_certificates : "holds"
  customers ||--o{ orders : "places"
  customers ||--o{ invoices : "billed on"
  customers ||--o{ payments : "makes"

  staff_users ||--o{ sessions : "opens"
  wholesale_users ||--o{ sessions : "opens"

  products ||--o{ product_images : "has"

  suppliers ||--o{ purchase_orders : "fulfills"
  purchase_orders ||--|{ purchase_order_lines : "contains"
  purchase_orders ||--o{ stock_movements : "ref"

  ship_tos ||--o{ orders : "snapshot"
  orders ||--|{ order_lines : "contains"
  orders ||--o{ stock_movements : "ref"
  orders ||--o| invoices : "may create"
  orders ||--o{ tax_commits : "quoted on"

  stock_movements }o--|| stock_snapshots : "updates"

  invoices ||--o| tax_commits : "commits"
  tax_commits ||--|{ tax_commit_lines : "contains"
  invoices ||--|{ invoice_tax_lines : "frozen copy"
  invoices ||--o{ payment_applications : "receives"
  payments ||--o{ payment_applications : "applies to"

  subscriptions ||--o{ add_on_grants : "includes"
  subscriptions ||--o{ software_payments : "history"
  subscriptions ||--o{ flag_overrides : "ops"
  issue_reports ||--o{ operator_outbox : "forward"
  software_payments ||--o{ operator_outbox : "notify"
```

---

## Relations list

| From | To | Link | Notes |
| --- | --- | --- | --- |
| `wholesale_users` | `customers` | `customer_id` | Bound at login |
| `sessions` | staff or wholesale user | `actor_type` + `actor_id` | Opaque cookie session |
| `product_images` | `products` | `product_id` | Bytes in object storage |
| `products` | — | `tax_category_code` | Engine tax code, **not** a percent |
| `purchase_orders` | `suppliers` | `supplier_id` | |
| `purchase_order_lines` | `purchase_orders` | `purchase_order_id` | Lines freeze sku/name |
| `contacts` | `customers` | `customer_id` | |
| `ship_tos` | `customers` | `customer_id` | Default and extra ship-to addresses |
| `exemption_certificates` | `customers` | `customer_id` | File in object storage; metadata + expiry |
| `orders` | `customers` | `customer_id` | ID only — not a nested aggregate |
| `orders` | `ship_tos` | snapshot columns | Copy address at order time |
| `order_lines` | `orders` | `order_id` | Lines freeze sku/name/price/`tax_category_code` |
| `stock_movements` | PO or order | `ref_type` + `ref_id` | Ledger provenance |
| `stock_snapshots` | — | `sku` + `location_id` | Read model; updated with each movement |
| `tax_commits` | order and/or invoice | `order_id`, `invoice_id` | Engine transaction id; quoted vs committed vs voided |
| `tax_commit_lines` | `tax_commits` | `tax_commit_id` | Jurisdiction, `rate_bps`, taxable base, tax `Money` |
| `invoices` | `orders` | `order_id` | `subtotal` / `tax_total` / `total` as integer minor units + currency |
| `invoice_tax_lines` | `invoices` | `invoice_id` | Frozen copy of committed tax lines; never recomputed |
| `invoices` | `customers` | `customer_id` | Denormalized for AR lists |
| `payments` | `customers` | `customer_id` | |
| `payment_applications` | `payments` + `invoices` | both FKs | Supports partial pay |
| `add_on_grants` | `subscriptions` | `subscription_id` | Paid or complementary pack |
| `software_payments` | `subscriptions` | `subscription_id` | Money **to the developer**; not customer AR |
| `flag_overrides` | `subscriptions` | `subscription_id` | Operator force-on / force-off |
| `issue_reports` | — | local `issue_id` | Saved here first; forwarded later |
| `operator_outbox` | — | `idempotency_key` unique | Fail-soft messages to the other repo |

### Intentionally not a live FK

| From | Toward catalog | Instead |
| --- | --- | --- |
| `purchase_order_lines` | `products` | Copy **sku / name** at write time |
| `order_lines` | `products` | Copy **sku / name / unit_price / tax_category_code** at write time |
| `invoice_tax_lines` | engine / tax tables | Copy committed amounts; do not re-quote a posted invoice |

History must not change when the catalog, a rate, or the engine changes later.

---

## Inventory in the middle

Purchasing and sales never write quantity columns. They emit movements; inventory updates the snapshot in the same transaction.

```mermaid
flowchart LR
  purchasing["purchasing<br/>PO confirm / receive"] --> movements
  sales["sales<br/>confirm / cancel / ship"] --> movements
  movements["stock_movements"] --> snapshots["stock_snapshots<br/>on_hand · on_order · allocated · available"]
```

`available` = `on_hand − allocated` (derived). v1 does not sell against inbound PO qty.

---

## Tax

Checkout **quotes**; invoice post **commits**. Stock allocate and tax HTTP are not one database transaction. See [`tax.md`](./tax.md).

```mermaid
flowchart LR
  cart["cart / checkout"] -->|quote| engine
  invoice["invoice post"] -->|commit| engine
  engine["ITaxCalculator"] --> commits["tax_commits + lines"]
  commits -.->|frozen copy| invoice_lines["invoice_tax_lines"]
```

`products.tax_category_code` is a code, not a percent. Rates live in the engine.

---

## Open on the call

These three are still open. [`invariants.md`](./invariants.md) §18 restates them with recommended v1 defaults and the other gaps they imply (ATP reject-all, credit formula, PO receive, statements).

1. Invoice on **confirm** or on **ship**? (Tax **commits** at that same moment.)
2. Separate **cart** table, or draft **orders**?
3. Any missing documents for day one (credit memo, RMA, blanket PO)?
4. Hosted engine: **Avalara AvaTax** (default for wholesale resale) vs cheaper Stripe Tax if few-nexus?

Software subscription tables above are **operator-facing** (the developer billing this tenant). They are not part of the wholesale glossary call. See [`licensing.md`](./licensing.md). `issue_reports` / `operator_outbox` are the door to a **separate** developer monorepo — [`operator-bridge.md`](./operator-bridge.md).
