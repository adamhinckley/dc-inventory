# `available` generated column vs repository derivation

Ticket: [ADA-46](https://linear.app/adamhinckley/issue/ADA-46/available-generated-column-vs-repository-derivation)
Type: grilling
Parent map: [ADA-41](https://linear.app/adamhinckley/issue/ADA-41/phase-0-implementation-spec-map)
Related: [ADA-44](https://linear.app/adamhinckley/issue/ADA-44/phase-0-column-deny-list-and-ops-users) left this storage choice open

This is a Phase 0 spec lock, not an implementation. Do not add Drizzle table files, generated-column SQL, or an Inventory repository in this note.

The ATP **formula** is already locked (`available = on_hand − allocated`). This ticket only names **where** that projection lives. Do not edit [`invariants.md`](../../invariants.md) §18 or tick [`open-questions.md`](../../open-questions.md).

---

## Decision

**Omit `inventory.stock_snapshots.available`.** Persist `on_hand`, `allocated`, and `on_order` only.

**Derive `available = on_hand − allocated` in the Inventory repository** (Drizzle adapter) **and the matching in-memory adapter.** A tiny domain helper / snapshot getter is allowed so those two adapters share one subtraction. Use cases never assign `available`.

**Do not add a Postgres generated column** (`GENERATED ALWAYS AS (on_hand - allocated) STORED` or Drizzle `.generatedAlwaysAs(...)`).

---

## Why repository derivation, not a generated column

| Pressure | Why it loses |
|---|---|
| “Generated column makes `available` non-writable” | Omitting the column is stronger: there is nothing to `INSERT`/`UPDATE`. A generated column still appears on the Drizzle table; agents treat it as stored qty. |
| “DB should guarantee the formula” | Phase 0 targets **Postgres 16** (compose) / **Neon**. Generated columns there are **`STORED`** (persisted). [`AGENTS.md`](../../../AGENTS.md) / architecture: never **store** `available` as source of truth. Virtual generated columns are Postgres 18 — not this stack. |
| “One place that cannot drift” | In-memory adapters are mandatory. A generated column **duplicates** the formula in SQL **and** TypeScript. [`stack.md`](../../stack.md): no stored-procedure business logic; invariants live in TypeScript so tests do not need Postgres. |
| “Staff tables sort/filter by `available`” | The query adapter may `SELECT (on_hand - allocated) AS available` and `ORDER BY (on_hand - allocated)`. That is a read projection, not a column. |
| “Later sell-against-PO (I6)” | Changing the projection is a **new rule**, not a ledger rewrite. A generated column turns that into a snapshot migration (owner-gated). A helper change does not. |

The allocation lock already uses the formula, not a stored field ([`stack.md`](../../stack.md) §4: `on_hand - allocated < requested` under `FOR UPDATE`).

ADA-44 already classified `available` as **not a writable dump column**. This ticket closes the leftover: it is also **not a physical column**.

---

## What Phase 0 persists on `inventory.stock_snapshots`

Read model only. Written only by Inventory, in the same transaction as the movement.

| Column | Persist? | Notes |
|---|---|---|
| `id` | Yes | UUID PK (ER-only ticket may name timestamps) |
| `sku` | Yes | With `location_id`, unique grain (I10) |
| `location_id` | Yes | FK to `inventory.locations` |
| `on_hand` | Yes | Integer qty. Inventory writes from movements. |
| `allocated` | Yes | Integer qty. Inventory writes from movements. |
| `on_order` | Yes | Integer qty. Shown, not sellable (I6). |
| `available` | **No** | Not writable. Not generated. Not a view agents treat as a table. |

`available` remains a **read-model field** on the Inventory snapshot DTO / domain object (API and UIs already expose it). It is not a Postgres column.

---

## Where the formula lives

```
available = on_hand − allocated
```

| Layer | Allowed |
|---|---|
| Inventory domain | Pure helper or snapshot getter. Never a writable field. Never a business input. |
| Inventory Drizzle repository | Map `on_hand` / `allocated` / `on_order` only. Set `available` from the helper on read. Never include `available` in `INSERT`/`UPDATE`. |
| In-memory Inventory adapter | Same helper. Tests must not need Postgres to get `available` right. |
| Query / list SQL | `(on_hand - allocated)` in `SELECT` / `ORDER BY` / `WHERE` if a list sorts or filters by `available`. Do not persist the result. |
| Use cases | Read `available` from the Inventory port. Never assign it. Never take it from a client body. |
| Frontends | Orval field only. Never `onHand - allocated` in the browser (I4). |
| Catalog / Sales / imports | No qty columns. No `available` input (I5, K3). |

One subtraction, two adapters. Not one subtraction in Postgres and a second one “for tests.”

---

## What Phase 0 must not do

- Add `available integer` (writable) to `stock_snapshots`.
- Add `available integer GENERATED ALWAYS AS (on_hand - allocated) STORED`.
- Use Drizzle `generatedAlwaysAs` (or equivalent) for this field.
- Add a SQL view named `stock_snapshots` / `available` that hides the omit.
- Put the formula in Sales, Catalog, a controller, or a frontend hook.
- Change the formula (sell against `on_order`, include inbound, floor at zero, …). That is I6 / I11 — owner tests first.
- Invent adjustment-sign or negative-stock rules (G3).

---

## Spec one-liner (copy into ADA-41 / the Phase 0 spec)

> Omit `inventory.stock_snapshots.available`. Persist `on_hand`, `allocated`, `on_order` only. Derive `available = on_hand - allocated` in the Inventory repository and in-memory adapter (domain helper allowed). Do not add a Postgres generated column.
