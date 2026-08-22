# available generated column vs repository derivation

**Ticket:** [available generated column vs repository derivation](https://linear.app/adamhinckley/issue/ADA-46/available-generated-column-vs-repository-derivation)
**Kind:** grilling (demo-only lock for the Phase 0 spec)
**Map:** [Phase 0 implementation spec map](https://linear.app/adamhinckley/issue/ADA-41/phase-0-implementation-spec-map)
**Not product law:** do not edit [`invariants.md`](../../invariants.md) §18 or tick [`open-questions.md`](../../open-questions.md)

---

## Decision

Phase 0 persists `inventory.stock_snapshots.available` as a **Postgres generated column**:

```sql
available INTEGER GENERATED ALWAYS AS (on_hand - allocated) STORED
```

Inventory still only **writes** movements and the snapshot fields `on_hand`, `allocated`, and `on_order`. Nothing accepts `available` as an input. Dump import must not set it.

ATP and lists may `SELECT available`. The formula does **not** include `on_order` (v1 does not sell against inbound PO qty).

---

## Meaning (unchanged)

**Available** is how many units of a SKU at a location can still be sold: **on-hand minus allocated**.

| Snapshot field | Role |
| --- | --- |
| `on_hand` | Physical stock (receipts − shipments − adjustments) |
| `allocated` | Confirmed sales not yet shipped |
| `on_order` | Open PO qty not yet received — **not** in available |
| `available` | Derived; never a third qty staff enter |

---

## Rejected

- **No column / repository-only math** — every query re-implements `on_hand - allocated`; agents later add a writable column.
- A **writable** `available` column (CRUD, dump, or `UPDATE`).

---

## Spec implications

- Drizzle: `generatedAlwaysAs` (or equivalent) on `available`; omit it from insert/update maps.
- Same transaction as today: lock snapshot → check available (column or equivalent expression) → insert movement → update `on_hand` / `allocated` / `on_order`.
- Do not store `available` on `catalog.products`.
