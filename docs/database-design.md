# Database design — table relations (rough draft)

> **Rough draft — not a locked schema.**  
> Starting point for stakeholder review. Use this on a call to confirm how tables connect.

One Postgres database · schema per context · inventory is the only place quantities are written.

Related: [`architecture.md`](./architecture.md) · [`stack.md`](./stack.md) · [`invariants.md`](./invariants.md) (locked rules; open call items expanded there)

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

  subgraph inventory["inventory · core"]
    stock_movements
    stock_snapshots
  end

  subgraph purchasing["purchasing"]
    suppliers
    purchase_orders
    purchase_order_lines
  end

  subgraph customers["customers"]
    customers_t["customers"]
    contacts
  end

  subgraph sales["sales"]
    orders
    order_lines
  end

  subgraph accounting["accounting"]
    invoices
    payments
    payment_applications
  end

  wholesale_users -->|customer_id| customers_t
  staff_users --> sessions
  wholesale_users --> sessions

  products --> product_images
  products -.->|sku snapshot| purchase_order_lines
  products -.->|sku + price snapshot| order_lines

  suppliers --> purchase_orders
  purchase_orders --> purchase_order_lines
  purchase_orders -->|movements| stock_movements

  customers_t --> contacts
  customers_t --> orders
  orders --> order_lines
  orders -->|allocate / ship| stock_movements
  stock_movements --> stock_snapshots

  orders --> invoices
  customers_t --> invoices
  customers_t --> payments
  payments --> payment_applications
  invoices --> payment_applications
```

**Happy path:** product → purchase order received → client order → stock allocates → invoice & payment.

---

## Entity relationships

```mermaid
erDiagram
  customers ||--o{ wholesale_users : "has logins"
  customers ||--o{ contacts : "has"
  customers ||--o{ orders : "places"
  customers ||--o{ invoices : "billed on"
  customers ||--o{ payments : "makes"

  staff_users ||--o{ sessions : "opens"
  wholesale_users ||--o{ sessions : "opens"

  products ||--o{ product_images : "has"

  suppliers ||--o{ purchase_orders : "fulfills"
  purchase_orders ||--|{ purchase_order_lines : "contains"
  purchase_orders ||--o{ stock_movements : "ref"

  orders ||--|{ order_lines : "contains"
  orders ||--o{ stock_movements : "ref"
  orders ||--o| invoices : "may create"

  stock_movements }o--|| stock_snapshots : "updates"

  invoices ||--o{ payment_applications : "receives"
  payments ||--o{ payment_applications : "applies to"
```

---

## Relations list

| From | To | Link | Notes |
| --- | --- | --- | --- |
| `wholesale_users` | `customers` | `customer_id` | Bound at login |
| `sessions` | staff or wholesale user | `actor_type` + `actor_id` | Opaque cookie session |
| `product_images` | `products` | `product_id` | Bytes in object storage |
| `purchase_orders` | `suppliers` | `supplier_id` | |
| `purchase_order_lines` | `purchase_orders` | `purchase_order_id` | Lines freeze sku/name |
| `contacts` | `customers` | `customer_id` | |
| `orders` | `customers` | `customer_id` | ID only — not a nested aggregate |
| `order_lines` | `orders` | `order_id` | Lines freeze sku/name/price |
| `stock_movements` | PO or order | `ref_type` + `ref_id` | Ledger provenance |
| `stock_snapshots` | — | `sku` + `location_id` | Read model; updated with each movement |
| `invoices` | `orders` | `order_id` | |
| `invoices` | `customers` | `customer_id` | Denormalized for AR lists |
| `payments` | `customers` | `customer_id` | |
| `payment_applications` | `payments` + `invoices` | both FKs | Supports partial pay |

### Intentionally not a live FK

| From | Toward catalog | Instead |
| --- | --- | --- |
| `purchase_order_lines` | `products` | Copy **sku / name** at write time |
| `order_lines` | `products` | Copy **sku / name / unit_price** at write time |

History must not change when the catalog is edited later.

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

## Open on the call

These three are still open. [`invariants.md`](./invariants.md) §18 restates them with recommended v1 defaults and the other gaps they imply (ATP reject-all, credit formula, PO receive, statements).

1. Invoice on **confirm** or on **ship**?
2. Separate **cart** table, or draft **orders**?
3. Any missing documents for day one (credit memo, RMA, blanket PO)?
