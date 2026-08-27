# Architecture invariants (v1)

Companion to [`architecture.md`](./architecture.md). That document is the module map. This one is the **checklist of rules that must always hold**, plus the decisions the initial plan still needs before a slice is agent-ready.

Sources: [`architecture.md`](./architecture.md), [`stack.md`](./stack.md), [`database-design.md`](./database-design.md), [`api-contract.md`](./api-contract.md), [`tax.md`](./tax.md), [`observability.md`](./observability.md), [`licensing.md`](./licensing.md). Stakeholder language on the share site is cited only in [§18](#18-what-the-initial-plan-still-needs) where it exposes a gap.

**How to use this.** Owner-written unit tests for gated zones should encode the locked rules in [§1–§16](#1-system-shape). Coding agents make those tests pass without changing the rule. Changing a locked rule is a plan change, not a ticket. Gaps in [§18](#18-what-the-initial-plan-still-needs) are not yet tests — pick a default, write it here, then write the failing test.

---

## 1. System shape

| ID | Invariant |
|---|---|
| S1 | One modular monolith: one process, one Postgres, one deploy. Contexts are packages, not services. |
| S2 | Two wholesale products plus an **ops control plane**, one backend. Shared use cases; different HTTP adapters, auth, DTOs, and UX. Internal is a dashboard; wholesale is a shop; ops is licensing/flags for the operator and business owner. |
| S3 | Frontends are presentation-only driving adapters, not extra backends and not skins of the same admin. |
| S4 | Operational surface stays tiny: one API process, managed Postgres, object storage for bytes. No Kubernetes, no second runtime for “performance.” |
| S5 | v1 is a **single warehouse**. `LocationId` exists and is currently `DEFAULT`. Multi-location ATP is additive later, not a rewrite. |
| S6 | Stock identity in v1 is **SKU** (see [§18](#18-what-the-initial-plan-still-needs) for the unresolved “item number” wording). Product variants are not a first-class aggregate. |
| S7 | Domain events in v1 are **in-process**. Kafka / inventory outbox are not v1. The operator **bridge** may persist a local queue so a separate developer repo can be wired later without blocking stock. |
| S8 | Inventory correctness is transactional (ACID + row lock), not eventually consistent on the number staff and clients see. |
| S9 | The module map depends on an ACID database and a session that binds `customerId` on the server. It does not depend on Fastify vs another HTTP library. |
| S10 | This operating model is **build-time coding agents** only. In-product domain AI (reorder bots, auto-remediation) is out of scope. |

---

## 2. Bounded contexts and anti-corruption

| ID | Invariant |
|---|---|
| C1 | Each context owns a coherent model. Other contexts may hold an **ID** or a **snapshot**, never the foreign aggregate. |
| C2 | Sales never imports Catalog’s `Product`. It uses a `ProductSnapshot` (sku, name, unit price at order time) via `ICatalogProductPort`. |
| C3 | Purchasing never imports Catalog’s `Product`. It snapshots supplier-facing product identity (sku, name) at write time. |
| C4 | Sales and Accounting hold `CustomerId`, not a Customer aggregate. Credit checks go through `ICreditCheckPort`, not a shared table join in a use case. |
| C5 | Customer does not contain orders. Order holds `CustomerId`. |
| C6 | Inventory is the **only** writer of quantities. Catalog, Purchasing, and Sales do not `UPDATE` qty columns. They call Inventory ports (or emit events Inventory handles — see [G1](#g1-inventory-write-path-ports-vs-events-vs-one-transaction)). |
| C7 | On-hand does not live on `Product` or on `SalesOrder`. Ledger + per-SKU snapshot live in Inventory. |
| C8 | `PurchaseOrder` is its own aggregate (Purchasing). Receiving records a receipt against the PO, then Inventory records `GoodsReceived`. |
| C9 | `SalesOrder` is its own aggregate (Sales). Confirming it asks Inventory to **commit** demand; Inventory may reject if locked `availableToSell` is insufficient. Warehouse `Allocated` is cover against `on_hand`, not the confirm gate. |
| C10 | A use case that needs both an order and a stock number talks to **two ports**. It is not a reason to merge aggregates. |
| C11 | Reporting views may join later. They are not the write model. Use cases do not cross-schema join `catalog.products` from Sales (etc.). |
| C12 | A PO is a purchasing document, not a journal entry. Accounting v1 is AR only — not GL, not AP from POs, not inventory valuation, **not software subscription**. |
| C13 | Licensing is the only writer of software entitlements and **software payment history** (money to the developer). Other contexts read `IFeatures` / `FeatureName` only. |
| C14 | Paid add-ons are Licensing `AddOnId`s, not Catalog products and not Inventory SKUs. |
| C15 | Sales and Accounting **never** compute tax. They pass address, line, and exemption snapshots into `ITaxCalculator`. Catalog stores `taxCategoryCode`, not a rate. |

### Shared kernel (tiny)

The only types allowed to be imported across contexts:

- `Money` (integer minor units + currency; validated at construction)
- `Sku`
- Typed IDs (`ProductId`, `CustomerId`, `OrderId`, `PurchaseOrderId`, `LocationId`, `TenantId`, `AddOnId`, `InstallationId`, …)

Nothing else. If two contexts need the same concept, copy a snapshot or add a port. Do not grow the shared kernel.

---

## 3. Dependency rule (every context)

| ID | Invariant |
|---|---|
| D1 | Every `import` in `domain/` and `application/` points only toward `domain/` or the shared kernel. |
| D2 | Domain and use cases never import adapters, HTTP frameworks, ORM/Drizzle models, S3 SDKs, Better Auth, Stripe, tax-engine SDKs, Zod, Sentry, or the logger SDK. |
| D3 | A file under `domain/` or `application/` must compile with no Node HTTP, Drizzle, auth-library, Stripe, or tax-SDK imports. |
| D4 | A controller does three things only: parse the request, call **one** use case, map the response. No business logic, no SQL. |
| D5 | A repository persists and reconstitutes an aggregate. It does not orchestrate other use cases. |
| D6 | HTTP composition (routers, DI, pool, S3) lives at the composition root (`apps/api/`). Domain packages never import the root. |
| D7 | Do not duplicate business logic in HTTP adapters. Different shapes → map DTOs; do not fork the use case. |
| D8 | Zod is adapter-only. Never put Zod (or class-validator / Pydantic-style HTTP models) on domain entities. |
| D9 | In-memory adapters are required for every port that a unit test exercises. They are not optional. |
| D10 | If a use case test “needs a database,” business logic has leaked into an adapter. |

---

## 4. Money, quantities, and identifiers

| ID | Invariant |
|---|---|
| T1 | Money is integer **minor units** (cents) + currency. Never `FLOAT` / `REAL` / `DOUBLE` in domain, DB, APIs, files, or charts. |
| T2 | `Money` is validated at construction. Invalid money cannot exist as a value object. |
| T3 | Chart `y` for money is integer cents. The chart library only formats for display. UI formatters convert cents at the edge only. |
| T4 | Quantities are integers (`INTEGER` / `BIGINT`). Never float. |
| T5 | IDs are UUIDs. SKU is `TEXT` with a unique constraint. |
| T6 | Multi-currency **beyond storing** `Money.currency` is not v1. Do not implement FX, dual books, or mixed-currency arithmetic until the plan adds it. |
| T7 | Card PANs are never stored. Accounting AR and Licensing software billing may **record a payment**; neither is a card vault. |
| T8 | Export files pick **one** money representation per export (integer cents **or** a single documented decimal format) and test it. Do not mix. |

---

## 5. Inventory: ledger and ATP

This is the hard problem. Get it wrong and every “available” screen drifts.

### Source of truth

| ID | Invariant |
|---|---|
| I1 | **Stock movements** are the source of truth. The availability snapshot is a **read model**. |
| I2 | The snapshot for a SKU is updated in the **same database transaction** as the movement. v1 has no eventual-consistency gap on the number staff and clients see. |
| I3 | `available` and `availableToSell` are never business inputs and are never assigned by a use case as raw fields. `available` is `on_hand − allocated` (computed, or a derived column the Inventory adapter maintains). `availableToSell` is computed per I6 ([ADR 0008](./adr/0008-available-to-sell-open-locked.md)). |
| I4 | Frontends never compute `available`, `availableToSell`, or any stock figure. A list that shows stock figures is a query use case that reads the Inventory read model. |
| I5 | Imports must not write `available`, `availableToSell`, `committed`, or raw on-hand. A stock-count import is an `Adjustment` movement and is owner-gated. |
| I6 | **Available to sell** ([ADR 0008](./adr/0008-available-to-sell-open-locked.md)). Open vs locked is **per SKU per organization**, not a company-wide season flag. New SKUs start **open** (confirm has no numeric sellability cap). The first `InboundFromPo` **locks** the SKU. Optional `windowOpensAt` / `windowClosesAt` on the SKU: outside that window the SKU is locked even with no PO. First PO still locks immediately inside the window. Lock is sticky until staff reopen a list of SKUs. Locked formula: `availableToSell = on_hand + on_order − committed`. Clients buy against inbound and, while open, before any factory PO exists. `available` (warehouse leftover) stays `on_hand − allocated` and non-negative. |
| I7 | Confirm order and insert `Committed` happen in **one transaction**, with a row lock on that SKU’s snapshot (`SELECT … FOR UPDATE` or equivalent). Effective sell state uses the **injected clock** vs the sell window. Cover (`Allocated` against leftover `available`) may run in that same transaction and/or later on `GoodsReceived`. |
| I8 | Do not check availability in the app, then write in a second round trip with no lock. |
| I9 | Inventory may reject **commit** if locked `availableToSell` is insufficient. Confirm does not oversell sellability. Warehouse `Allocated` may be less than `committed`. Ship consumes `Allocated` only. |
| I10 | Snapshot grain is `(sku, locationId)`. |
| I11 | Ledger math and the ATP formula are owner-specified (failing tests first). Agents do not invent or soften them. |
| I12 | Inventory snapshot/ledger migrations are owner-gated. Agents may migrate **their** context’s schema only. |

### Movement types (locked)

| Movement | Effect |
|---|---|
| `InboundFromPo` | Increases `on_order` when a PO is placed/confirmed. First inbound for the SKU **locks** sell state (even inside the sell window). |
| `GoodsReceived` | Decreases `on_order`, increases `on_hand`. Then FIFO-cover committed qty that is not yet `Allocated`. |
| `InboundCancelled` | Decreases `on_order`. Does not reopen the SKU. |
| `Committed` | Increases `committed` when a sales order is confirmed (demand / pre-sold). |
| `Decommitted` | Decreases `committed` on cancel, reject, or line-level manufacturer miss. |
| `Allocated` | Increases `allocated` as warehouse cover against `on_hand`. May occur at confirm and again on receive. |
| `Deallocated` | Decreases `allocated` when cover is released. |
| `Shipped` | Decreases `allocated`, `on_hand`, and `committed`. |
| `Adjustment` | Explicit on-hand correction (shrink, count, damage). |

### Read model (what UIs show)

For each `(sku, locationId)`:

```
on_hand           = receipts − shipments − adjustments
on_order          = open PO qty not yet received
committed         = confirmed sales qty not yet shipped or decommitted
allocated         = warehouse cover against on_hand (never exceeds on_hand)
available         = on_hand − allocated
availableToSell   = effectiveOpen ? (no cap) : on_hand + on_order − committed
uncovered         = max(0, committed − on_hand − on_order)
```

`effectiveOpen` is persisted-open, inside the optional sell window, and not yet sticky-locked by a PO or by `windowClosesAt`. `uncovered` is the factory to-order list, not a shop number. The `on_hand` line assumes a **signed** adjustment convention that is not yet closed — see [G3](#g3-adjustment-sign-and-negative-stock).

---

## 6. Purchasing

| ID | Invariant |
|---|---|
| P1 | Purchasing owns suppliers (factories), purchase orders, and receiving. It does not own on-hand qty. |
| P2 | PO confirm emits `InboundFromPo`. Receipt emits `GoodsReceived` via Inventory ports. |
| P3 | PO lines freeze sku/name at write time. Later catalog edits must not rewrite PO history. |
| P4 | The PO aggregate in Postgres is the source of truth. A PDF is a **projection** (`IPdfRenderer` → `IFileStorage` → key on the PO). |
| P5 | Inbound supplier PDFs/scans are attachments in v1. Humans enter lines. Do not block Purchasing on OCR. |
| P6 | A PO is not an accounting journal entry and does not create AP bills in v1. |

---

## 7. Sales and wholesale shop

| ID | Invariant |
|---|---|
| O1 | Sales owns wholesale orders, line items, and status. It does not own customer master beyond `CustomerId`, and it does not own live stock. |
| O2 | Order lines freeze sku, name, and unit price at write time. Catalog edits must not rewrite order history. |
| O3 | Draft / line-item work is medium autonomy. **Commit on confirm is gated** (owner tests first). |
| O4 | Wholesale cart and checkout call Sales use cases with `customerId` from the session, never from the client body. |
| O5 | Wholesale catalog may return price, images, `available`, and `availableToSell`. It never returns cost, supplier, or other customers’ orders. |
| O6 | Wholesale users never import into Catalog or Inventory. They do not get staff DataTables or report charts. |
| O7 | Staff “place order on behalf of customer” is an **internal** use case: `customerId` comes from the staff DTO and still goes through credit + commit ports. |
| O8 | Wholesale `GetOrder` loads by id **and** session `customerId`. Missing row and other-customer’s row look the same (`404`), not a `403` that leaks existence. |
| O9 | Cannot-modify-a-submitted-order is a **use-case / domain** rule, not middleware. (Exact statuses: [G5](#g5-sales-order-state-machine).) |
| O10 | Wholesale browse is shop search/filter, not the internal `x-table` protocol. Do not put `DataTable` on the shop. |

---

## 8. Catalog

| ID | Invariant |
|---|---|
| K1 | Catalog owns SKU, name, description, images, list/wholesale price. It does not own stock counts. |
| K2 | Product image **bytes** live in object storage. Postgres stores metadata + object keys only. |
| K3 | Catalog CRUD is high autonomy **except** it must not add qty columns or treat `available` / `availableToSell` as writable. |

---

## 9. Customers and credit

| ID | Invariant |
|---|---|
| U1 | Customers owns accounts, contacts, terms, and the credit-limit **field**. It does not own invoices. |
| U2 | Credit **enforcement** at order time is a business rule in the Sales use case via `ICreditCheckPort`. Not `if (role)` in a domain entity. Not a Customers CRUD ticket. |
| U3 | Customer balance (AR) is a projection of invoices minus payments (optionally a snapshot via events). It is not a hand-edited field that bypasses Accounting. |
| U4 | Permission matrices and credit/stock gates are owner-reviewed. |

The credit-limit **formula** (what counts against the limit) is not closed — see [G6](#g6-credit-limit-formula).

---

## 10. Accounting (AR only)

| ID | Invariant |
|---|---|
| A1 | Accounting v1: invoices, payments, AR **owed by wholesale customers**. Out of scope: GL, inventory asset valuation, AP, tax **return filing**, **software subscription**. Tax **calculation** is Tax context (`ITaxCalculator`), not Accounting math. |
| A2 | Invoice is created when the sales order **ships**. One invoice per sales order in v1. Tax **commits when that invoice posts**. Confirmed-but-unshipped orders are not invoiced. Due date = invoice date + customer terms, copied onto the invoice. |
| A3 | Payments are applied to invoices (`payment_applications` supports partial pay) against the invoice **total**, which includes committed tax. |
| A4 | Payment application and AR balance are owner-gated. Agents do not invent AR rules or use float cash. |
| A5 | Invoice PDF is a projection of our aggregates, same as PO PDF. |
| A6 | Wholesale may download **their** invoices/order PDFs only if the wholesale spec includes the operation. |

A `SoftwarePayment` is not an Accounting payment.

---

## 10a. Tax (quote / commit)

Full narrative: [`tax.md`](./tax.md).

| ID | Invariant |
|---|---|
| TX1 | Tax calculation is `ITaxCalculator` (quote / commit / void). Sales, Accounting, Catalog, and UIs never `price * rate`. |
| TX2 | Checkout **quotes**. Invoice **post** **commits**. The committed `Money` (and tax lines) are frozen on the invoice and never recomputed from today’s engine. |
| TX3 | Fail closed: engine down or garbage → do not confirm an order or post an invoice with `tax = 0`. |
| TX4 | Tax HTTP is **not** inside the Inventory `FOR UPDATE` transaction. Allocate stock, then quote/commit as a separate I/O. Commit is idempotent; void if invoice post fails after a successful commit. |
| TX5 | Catalog stores `taxCategoryCode`, not a percent. Customers store ship-to + exemption **files and metadata**; enforcement is owner-gated. |
| TX6 | Convert engine floats to `Money` in the Tax adapter. Domain never sees `0.0875`. |
| TX7 | Production adapter is a hosted engine (default AvaTax). In-memory adapter is required in unit tests. SDK lives only in `packages/tax/adapters`. |
| TX8 | Return filing, remittance, use tax on POs, and CertCapture-class certificate campaigns are **not** v1. |

---

## 10b. Licensing (software subscription and flags)

Full narrative: [`licensing.md`](./licensing.md).

| ID | Invariant |
|---|---|
| L1 | Software subscription money (tenant → **developer**) lives in Licensing. Wholesale customer AR lives in Accounting. No shared payment table. |
| L2 | `software_payments` is append-only history (status changes are new facts or a documented status field — never silent delete). Amount is `Money`. |
| L3 | `IFeatures.isEnabled` is the only way other contexts learn entitlements. They do not import `Subscription` or Stripe types. |
| L4 | Flag checks belong at the HTTP adapter or a use-case decorator. They must not live inside Inventory ATP, credit formula, or `customerId` binding. |
| L5 | A hidden UI is not security. Gated routes still `403` (or documented payment-required) when the flag is off. |
| L6 | `FeatureName` is a closed catalog in Licensing. Agents do not invent flag strings in controllers. |
| L7 | Evaluation order: operator override, then core∩active/trialing subscription, then add-on/plan entitlement, else false. Force-off wins over force-on. |
| L8 | Entitlement grant and (when money moved) `SoftwarePayment` update the flag projection in the **same transaction**. v1 has no eventual flags. |
| L9 | Staff and wholesale sessions cannot write flags, complementary grants, or software checkout. That is `/ops` only. |
| L10 | Business owners may view history and buy add-ons. They cannot write `FlagOverride` or complementary grants. |
| L11 | Billing-provider webhooks are idempotent on `provider_ref`. Failed signature never reaches domain. |
| L12 | `TenantId` is `DEFAULT` in v1. Multi-tenant is additive, not a rewrite. Lapsing an add-on does not roll back stock or sales orders. |
| L13 | After a software payment or entitlement change is **committed**, enqueue an operator-bridge message. Publish failure must not roll back Licensing. |

---

## 10c. Operator platform bridge

Full narrative: [`operator-bridge.md`](./operator-bridge.md).

| ID | Invariant |
|---|---|
| B1 | The developer’s multi-product business platform is a **different repo**. This monolith does not host it and does not import its domain. |
| B2 | This app identifies itself with stable `ProductCode` (`dc-inventory`) + `InstallationId` + `TenantId`. |
| B3 | Outbound kinds are a closed set: `license.snapshot`, `income.recorded`, `issue.reported`, `heartbeat`. Agents do not invent kinds. |
| B4 | Publish is **fail-soft after local persist**. Inventory, sales, login, and software-payment success do not depend on the other repo. |
| B5 | Issue reports are saved **in this database** first. The user is done when that save succeeds. No helpdesk UI in this app. |
| B6 | Bridge payloads have no PAN, no session tokens, and no wholesale customer PII by default. No order lines or ATP. |
| B7 | Messages carry `idempotencyKey`. Replays must not double-count income on the other side (and must not double-insert locally). |
| B8 | `IOperatorPlatform` v1 may be no-op. The door is the port + outbox, not a live URL. |
| B9 | Staff/ops submit issues via this product’s API. Wholesale shop submit is off unless explicitly enabled. |
| B10 | Observability (Sentry, `/health`) is not the issue inbox. Feature flags stay `IFeatures`. In-app “build this feature with an agent” is a different, parked idea. |

---

## 11. Identity and authorization

| ID | Invariant |
|---|---|
| X1 | Three actor types in one Identity context: **Staff**, **Wholesale user**, **Operator / business owner** (ops). |
| X2 | Staff session is valid only on `/internal/*`. Wholesale session is valid only on `/wholesale/*`. Ops session is valid only on `/ops/*`. Separate cookie names, separate origins. |
| X3 | CORS allowlists **exactly** those three origins. |
| X4 | Mechanism is a **server-side session** (opaque id in cookie, row in Postgres). Not JWT in `localStorage`, not tokens in query strings or logs. |
| X5 | Cookies: `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`. HTTPS only in production. |
| X6 | Wholesale user is bound at login to `wholesaleUserId` + **`customerId`**. Handlers **overwrite** `customerId` from the session after Zod parse. If the body contains a customer id, ignore it. |
| X7 | Staff role elevation cannot be trusted from the client body. |
| X8 | Authz layers: (1) edge — valid session for that route tree; (2) staff RBAC — small **static** matrix; (3) **IFeatures** for paid packs; (4) business rules in use cases (credit, allocation, submitted-order); (5) resource scoping by `customerId`. |
| X9 | Do not sprinkle `if (role)` inside domain entities. |
| X10 | Better Auth (or equivalent) is an **Identity adapter only**, not the domain. Domain stays actor types, not the library’s User model. |
| X11 | v1 keeps users in our DB so `CustomerId` / ops `tenantId` binding stays in-process. Clerk/Auth0 are not the source of truth for customers. |
| X12 | Postgres RLS is not the primary authz mechanism. Application + session binding is the v1 gate. |
| X13 | Passwords are hashed by the auth adapter (Argon2id / scrypt). Never roll hashing in a use case. Never log passwords. |
| X14 | Rate-limit `/internal/auth/*`, `/wholesale/auth/*`, and `/ops/auth/*`. |
| X15 | Coding agents may wire login/session. Permission matrix, session `customerId` binding, credit/stock gates, and the `FeatureName` catalog are owner-reviewed. |
| X16 | v1 does not include SSO/SAML, third-party API keys, or per-SKU permissions. |

The actual role × action matrix is not written — see [G8](#g8-staff-rbac-matrix).

---

## 12. HTTP, lists, reports, frontends

| ID | Invariant |
|---|---|
| H1 | The HTTP API is the **only** contract the UIs may use. Frontends never hand-write `fetch` / axios to the API. Orval hooks only. |
| H2 | Three committed OpenAPI specs: `openapi/internal.yaml`, `openapi/wholesale.yaml`, `openapi/ops.yaml`. Wholesale must not list staff-only or ops-only operations. Internal must not list flag admin. |
| H3 | Zod route schemas **are** the OpenAPI source. CI fails if committed specs drift (`gen:api` + `git diff --exit-code`). |
| H4 | Internal lists share one protocol: explicit query params (`q`, `page`, `pageSize`, `sortBy`, `sortOrder`, typed filters). No JSON `filters` blob, no OData. |
| H5 | List response envelope is always `{ items, page, pageSize, total }`. No unpaginated “return everything” for tables. |
| H6 | `pageSize` max is 100 for tables. Exports are a separate operation with a documented higher row cap. |
| H7 | `x-table` tells the staff UI which columns/search/filters exist. The UI does not hardcode a filter form that disagrees with the API. |
| H8 | Adding a filter is a backend change (Zod + `x-table` + repository `WHERE`) plus `gen:api`. Frontends do not filter full datasets in the browser. |
| H9 | Search in v1 is Postgres (`ILIKE` / `pg_trgm`), not Elasticsearch. |
| H10 | Internal charts are report query use cases returning a small bucketed payload. Never fetch list pages and aggregate in React. |
| H11 | Do not add a general-purpose query builder or embed Metabase/Superset/Cube in v1. |
| H12 | Packages `ui` may format money/dates for display. They must not contain domain math (ATP, available-to-sell, AR, totals that disagree with the API). |
| H13 | Frontends must not import `packages/*/domain` or Drizzle schemas. |

---

## 13. Files, import, export, PDFs

| ID | Invariant |
|---|---|
| F1 | Bytes live in object storage (`IFileStorage`). Postgres stores metadata and object keys, never workbook or PDF blobs. Bytes never live on the API disk. |
| F2 | Spreadsheet import/export and generated PDFs go through file ports. The UI only uploads/downloads; it does not parse Excel or build PDFs in the browser. |
| F3 | Import is a use case, not a SQL dump: parse → validate each row → `{ rowsOk, errors: [{ row, field, message }] }`. Commit runs **existing** create/update use cases. |
| F4 | Silent partial imports with no error report are forbidden. Do not return 200 with a silent skip. |
| F5 | Export reuses the **same list query/filters** (not the current page of rows). Document the row cap. |
| F6 | Staff-only uploads (or presign staff-only), except wholesale downloads that exist on the wholesale spec. |
| F7 | Presigned PUT: allowlist `Content-Type` (jpeg/png/webp + spreadsheet/PDF types in OpenAPI), max size, random object key (not the original filename as the key). |
| F8 | Do not treat an uploaded XLSX as trusted SQL. |
| F9 | Max upload size is declared in OpenAPI and enforced in Fastify. |

---

## 14. Persistence

| ID | Invariant |
|---|---|
| DB1 | PostgreSQL is the only system of record (plus object storage for bytes). No Mongo/Dynamo/Firestore as primary. SQLite is fine for unit tests only. |
| DB2 | One database, **schema per context** (`identity`, `catalog`, `inventory`, `purchasing`, `sales`, `customers`, `accounting`, `licensing`, `operator_bridge`). |
| DB3 | Cross-context data is copied as IDs/snapshots at write time, not live FKs from order/PO lines to `catalog.products`. |
| DB4 | Invariants live in TypeScript domain + use cases so unit tests do not need Postgres. No stored-procedure business logic. Extensions in v1: `pgcrypto`/`uuid` and `pg_trgm` only. |
| DB5 | Sessions and rate-limit counters live in Postgres until there is a reason for Redis. Redis is not v1. |
| DB6 | Next.js Route Handlers are not the domain API. Fastify is the one composition root. |

---

## 15. Testing, agents, and ownership

| ID | Invariant |
|---|---|
| AG1 | Every use case runs in a plain unit test with in-memory adapters — no Postgres, no Docker, no network. |
| AG2 | A slice is agent-ready only when all three exist: port in `domain/`, use case skeleton in `application/`, failing unit tests in `tests/unit/`. |
| AG3 | The agent’s job is to make those tests pass **without changing the invariant** and without importing adapters from use cases. |
| AG4 | **One agent, one context, one branch.** Two agents must not write Inventory’s ledger or the shared kernel at the same time. |
| AG5 | Human owns: ports, invariants, failing unit tests for gated zones, PR review of inventory / money / authz. |
| AG6 | Gated (owner tests first): Inventory ledger / available-to-sell / open-locked, stock `Adjustment` import, commit when locked `availableToSell` is insufficient, payment/AR, authz / `customerId` binding, software subscription / webhooks / `FeatureName` catalog, operator-bridge message kinds. |
| AG7 | Vendor instruction files are optional **mirrors** of `AGENTS.md`. Do not put rules in only one vendor’s folder. |
| AG8 | Stop when the ticket’s unit tests are green. Do not expand scope. |
| AG9 | Reject PRs that add Redis, Prisma-as-data-layer, Mongo, GraphQL, tRPC, Nest, Kafka, Elasticsearch, JWT-in-localStorage, hand-written API `fetch`, Datadog, a metrics/log microservice, or LaunchDarkly as a required SDK. |
| AG10 | Do not grant production shell access to agents as the default remediation path; fix in git, deploy through the normal pipeline. |

Implementation order lock: do not start Sales allocation before Inventory tests exist. Do not start invoicing before Sales confirm exists.

---

## 16. Observability and secrets

| ID | Invariant |
|---|---|
| OP1 | Domain/application do not import Sentry, Pino, or OpenTelemetry. |
| OP2 | Client responses never include stack traces or secrets. |
| OP3 | Never log passwords, session tokens, `Authorization`, cookies, or card secrets. Full PII request bodies are not logged by default. |
| OP4 | Every API log line and error carries `requestId`. Actor type (`staff` \| `wholesale` \| `ops`) is allowed; raw session ids are not. |
| OP5 | `GET /health` proves process liveness only — no Postgres, S3, or external calls. Optional `GET /ready` is a cheap DB ping, not migrations. |
| OP6 | Business KPIs are internal **report endpoints**, not an observability product. |
| OP7 | No second deployable for metrics/logs (no Prometheus/Grafana/Loki/ELK collector) in v1. |
| OP8 | Secrets only in environment / host secret store. Never commit real `.env` values. |
| OP9 | Unit tests never call the network error reporter (fake `IErrorReporter` or no-op). |
| OP10 | If a signal cannot become a concrete fix (file path, stack, request id, or failing invariant), it is noise. Do not add it in v1. |

---

## 17. v1 scope locks (explicitly deferred)

Do not sneak these into v1 modules. Naming them here keeps agents from “helpfully” adding them:

- Multiple warehouses / transfers / per-location ATP beyond `LocationId = DEFAULT`
- Company-wide selling season as the infinity switch (open/locked and sell-window dates are per SKU; [ADR 0008](./adr/0008-available-to-sell-open-locked.md))
- Zoho-style purchase-request document (demand-to-PO is `uncovered`, not a request queue)
- First-class factory-to-customer drop-ship (keep fake receive-then-invoice; SKU+X workaround is operational)
- Season forecast from prior-year sales
- Native Faire API
- Product variants as a separate aggregate
- General ledger, AP, inventory asset valuation
- Tax **return filing**, remittance, nexus dashboards, use tax on POs, full certificate-lifecycle CMS (calculation + commit **is** v1 — [`tax.md`](./tax.md))
- Message broker, outbox, CQRS with a separate read DB
- Microservices / separate deployables per context (ops **UI hosting** may split later; inventory does not)
- OCR / extracting line items from arbitrary supplier PDFs or emails
- Embedded BI; full APM; runtime AI that auto-remediates production
- Retail / Shopify as a channel in these contexts (stakeholder language; make the deferral explicit — [G17](#g17-ubiquitous-language-mismatches-to-resolve-in-the-plan))
- SSO / SAML; API keys for third parties; fine-grained per-SKU permissions
- JWT access tokens for mobile (optional later; still bind `customerId` server-side)
- In-app feature-request control plane ([`ideas/in-app-feature-requests-to-coding-agents.md`](./ideas/in-app-feature-requests-to-coding-agents.md))
- LaunchDarkly (or similar) as a **required** runtime — later only as an `IFeatures` adapter
- Stripe Connect / marketplace; charging wholesale customers’ cards in v1
- Feature flags that disable ATP, credit checks, or session `customerId` binding
- Self-serve **signup UI** before the Signup milestone packets open — see [Multi-organization](https://linear.app/adamhinckley/project/multi-organization-c54d6b9bb02b) ([ADA-157](https://linear.app/adamhinckley/issue/ADA-157/multi-organization-implementation-map))
- Building the operator platform **in this repo**; bidirectional tickets; streaming inventory/AR to that platform

`LocationId` exists so multi-warehouse is additive: new locations, same ledger, same movement types. `TenantId` exists so multi-tenant licensing is additive. `InstallationId` exists so the operator platform can tell deploys apart. **`OrganizationId` is current** ([ADR 0007](./adr/0007-organization-id-current-not-deferred.md)): one implicit org in the v1 demo (`DEFAULT`), composite uniqueness and session overwrite in progress — not database-per-company.

---

## 18. What the initial plan still needs

Locked rules above are necessary but not sufficient. The items below are either flagged open in the plan, implied but unstated (agents will invent them), or present in stakeholder language and missing from the architecture. **Close these in the plan and in owner tests before the named slice is agent-ready.**

Priority: **P0** = decide before that gated slice is implemented (inventory / sales confirm / AR / identity). **P1** = decide in the initial plan so CRUD agents do not invent a second model. **P2** = name a v1 default or explicitly defer.

### G1. Inventory write path: ports vs events vs one transaction

Architecture says Purchasing/Sales “call Inventory ports **or** emit events that Inventory handles,” and also that confirm + `Committed` is **one transaction** with `FOR UPDATE`.

**Close:** Stock mutations are **synchronous commands** through Inventory ports, in the same DB transaction as the order/PO write. Confirm writes `Committed` (and as much `Allocated` cover as leftover `available` allows) in that transaction. Remaining cover is a synchronous command inside `GoodsReceived`, not an event after commit. In-process domain events may notify other contexts **after** that commit (e.g. “order confirmed” → Accounting). They must not be the mechanism that updates the ledger, or ATP will race.

### G2. Movement identity, idempotency, and ledger mutability

The plan does not say whether the ledger is append-only, how a double-clicked Confirm is rejected, or what unique key prevents two `Committed` rows for the same order line.

**Close for Inventory tests:**

- Movements are **append-only**. Corrections are new movements (`Decommitted`, `Deallocated`, compensating `Adjustment`), not `UPDATE` of an old row.
- `Committed`, `Decommitted`, `InboundFromPo`, `Shipped` stay once-only at `(organization_id, ref_type, ref_id, sku, movement_type)`. `Allocated` / `Deallocated` may repeat for the same order line (cover at confirm, then on receive); uniqueness is the idempotency key.
- Movement qty is a **positive integer**. Direction lives in the movement type, not a negative qty (except possibly signed `Adjustment` — [G3](#g3-adjustment-sign-and-negative-stock)).

### G3. Adjustment sign and negative stock

Read-model formula: `on_hand = receipts − shipments − adjustments`. That only works if “adjustments” are shrink-positive. Found stock (cycle count up) needs the opposite sign.

**Close:**

- `Adjustment` qty is **signed** (positive = increase on-hand, negative = decrease), **or** split into `AdjustmentIncrease` / `AdjustmentDecrease`.
- Whether `on_hand` may go **negative**.
- Whether an adjustment may drive `available` negative (on-hand below allocated). If yes, what Sales does on the next ship. If no, Inventory rejects the adjustment.

### G4. Insufficient available-to-sell on confirm

Locked sellability is `availableToSell`. Warehouse `available` is not the confirm gate ([ADR 0008](./adr/0008-available-to-sell-open-locked.md)).

**Close (v1, write into tests):** reject the **entire confirm** if any **locked** line exceeds `availableToSell` after locking those SKUs in a stable order (avoid deadlocks). Open SKUs have no numeric sellability cap. No partial confirm, no silent qty reduction, no backorder document in v1. Cart may display `availableToSell`; reservation happens at confirm, not while browsing. Cover (`Allocated`) may be partial.

### G5. Sales order state machine

Statuses are sketched (draft → confirm/allocate → ship) but not closed. Stack mentions “cannot modify a submitted order” without listing legal transitions.

**Close for Sales + Inventory tests:**

| From | To | Stock effect | Notes |
|---|---|---|---|
| `draft` | `confirmed` | `Committed` per line (and cover `Allocated` up to leftover `available`), or reject all | Lines editable only in `draft`. Locked SKUs gated on `availableToSell`. |
| `confirmed` | `cancelled` | `Decommitted` (+ `Deallocated` if covered) | Only if nothing shipped |
| `confirmed` | `shipped` | `Shipped` | See partial ship below |
| `draft` | `cancelled` | none | |

Still decide:

- **Partial ship:** forbidden in v1 (one `Shipped` for full remaining qty) vs allowed (multiple `Shipped` until allocated hits zero).
- **Cart vs draft order** (already open in [`database-design.md`](./database-design.md)): one `SalesOrder` in `draft` used as the cart, vs a separate cart DTO that becomes an order at checkout. Pick one so wholesale and staff-on-behalf share the same aggregate.
- Empty orders, zero qty, duplicate SKU on two lines (merge vs reject).
- Whether draft/cart qty may exceed `available` (show a warning; hard fail only at confirm).

### G6. Credit-limit formula

Credit is named as a use-case invariant but not specified.

**Close:** what counts against the limit at confirm — e.g. `open AR (invoiced unpaid) + this order total + confirmed-uninvoiced orders` vs invoices only. Same currency as `Money`. Fail the whole confirm (like locked `availableToSell`). Customers CRUD only stores the limit; it does not enforce it.

### G7. Invoice on confirm vs on ship

**Closed (2026-08-27 call + demo):** invoice when the sales order **ships**. One invoice per sales order. Confirmed-but-unshipped orders are not invoiced. Due date = invoice date + customer terms (Net 30/60/90), copied onto the invoice. Tax **commits at the same moment the invoice posts**. Statements are not invoices ([G13](#g13-customers-ship-to-terms-statements-confirmation-email)). Auto-dunning can stay weak; the AR ledger cannot.

### G8. Staff RBAC matrix

Roles are examples (`admin`, `purchasing`, `warehouse`). There is no matrix.

**Close a tiny static table** before Identity is more than login, for example:

| Action | admin | purchasing | warehouse | sales support |
|---|---|---|---|---|
| Catalog / customers CRUD | yes | yes | read | read |
| Create / send PO | yes | yes | no | no |
| Receive PO / adjust stock | yes | no | yes | no |
| Place order on behalf of customer | yes | no | no | yes |
| Apply payment | yes | no | no | no |

Without this, agents will either skip checks or invent a permission CMS.

### G9. Purchasing state machine (cancel, over/under receive)

`InboundFromPo` on place/confirm and `GoodsReceived` on receive do not specify:

- PO statuses (`draft`, `confirmed`, `partially_received`, `received`, `cancelled`).
- **Cancel after confirm:** must emit a compensating movement so `on_order` does not leak.
- **Over-receive / under-receive** vs PO line qty (reject over-receive in v1 is the safest default).
- **Partial receive** (likely needed on day one for wholesale importing).
- Whether confirm and “placed” are the same event (Excel-to-factory send vs internal confirm).

### G10. Payment application rules

`payment_applications` exists; rules do not.

**Close:** payment amount > 0; cannot apply more than invoice remaining; overpay rejected (no automatic credit memo in v1); unapplied payment remainder allowed or not; reverse/void vs compensating application; idempotency on “record payment.”

Credit memos, RMA, and blanket POs are already an open stakeholder question — **explicitly defer** in the plan if they are not day one, so agents do not add them as “helpful” Accounting types.

### G11. Cross-context transaction boundary

Confirm must write the sales order **and** the `Committed` movement atomically (I7) while keeping aggregates separate (C10).

**Close:** a composition-root / application unit of work wraps both ports in one Postgres transaction. In-memory tests use a single in-memory unit of work. Do not document “Inventory handles an event after commit” for commit or cover — that violates I2/I8.

### G12. Catalog identity: SKU vs item number, delete, categories

Stakeholder language uses **item number** and has not locked it as SKU. Architecture and Inventory ATP are SKU-based.

**Close in the initial plan (wording + rules):**

- One public identifier in v1 (`Sku` in code; label in the UI can say “item number” if the business prefers). Do not ship two identifiers.
- SKU is **immutable** after the first stock movement or order/PO line snapshot.
- Products are **archived**, not deleted, once referenced. Archived products are not sellable on wholesale; staff can still see history.
- Wholesale browse mentions **category**, but Catalog’s owned fields do not. Either add `category` (or a simple `product_group`) to Catalog v1, or remove category from the shop API sketch.

### G13. Customers: ship-to, terms, statements, confirmation email

The architecture Customers context is accounts, contacts, terms, credit. Stakeholder tables also have **`customer_ship_to`**, **invoice due-from-terms**, **statements**, and **confirm = page + matching email**.

**Close for the initial plan:**

| Topic | Why it belongs in v1 | Suggested default |
|---|---|---|
| Ship-to | Sales order “includes ship-to”; otherwise every order is a blob | `Customer` has one-or-more ship-to addresses; order snapshots address at confirm |
| Terms enum | Net 30/60/90 is the AR clock | Enum on customer; copied to invoice |
| Confirmation email | Stated as part of what a confirmed sales order *is* | `IEmailSender` port; confirm use case sends after commit; in-memory fake in tests |
| Statement | Distinct from invoice; due-date notice | **Defer** the send-job if needed, but name `Statement` as later — do not overload Invoice to mean statement |
| Tracking | “later” | Explicitly deferred |

Without `IEmailSender`, agents will either skip a business-visible invariant or put nodemailer in a controller.

### G14. Tenancy, currency, clock

**Close:**

- **Single wholesale company in the v1 demo** (`OrganizationId.DEFAULT`, `TenantId = DEFAULT` on Licensing — same string, 1:1 grain per [ADR 0007](./adr/0007-organization-id-current-not-deferred.md)). The **multi-org seam is in progress** on the [Multi-organization](https://linear.app/adamhinckley/project/multi-organization-c54d6b9bb02b) project: composite uniqueness and session `organizationId` overwrite so SKU/email do not freeze global. Demo seed stays one org; self-serve signup UI is a later milestone.
- **Currency:** store `Money.currency` but v1 operations are **one currency** (name it, likely USD). Mixing currencies on one order is rejected at construction. Software subscription currency should match or be documented.
- **Clock / timezone:** report buckets (`from`, `to`, `granularity`) use one named timezone (company local). Domain tests inject a clock port; do not call `new Date()` in domain entities.

### G15. Human-readable document numbers

IDs are UUIDs. Staff and factories will not read UUIDs on POs, orders, or invoices.

**Close:** each of PO, sales order, invoice has a unique **document number** (opaque sequence or `YYYY-#####`) assigned in the context that owns the aggregate. UUID remains the primary key. Snapshot the number onto PDFs.

### G16. Command and import atomicity

**Close:**

- Import **commit** is all-or-nothing per file **or** row-by-row with a persisted error report — pick one. Dry-run then commit has a race (catalog changed between); v1 can accept that if stated.
- Export cap (architecture’s “e.g. 10_000”) should be a single number in the API contract.
- Numeric upload caps (image vs spreadsheet vs PDF) should be numbers in OpenAPI, not “declared later.”

### G17. Ubiquitous language mismatches to resolve in the plan

Keep one word per concept in architecture + code + UI labels:

| Architecture / code today | Stakeholder share site | Risk if unset |
|---|---|---|
| Supplier | Factory (do not say vendor/supplier until locked) | Purchasing package vs UI copy vs table names |
| SKU | Item number (not locked as SKU) | Inventory grain vs how staff search POs |
| Wholesale user | Customer user / shop login | Identity entity name |
| Client DTO / “clients” in intro | Customer | Agents generate `Client` and `Customer` side by side |
| Statement (absent) | Statement ≠ invoice | Accounting invents a second invoice type |
| (not in architecture) | Shopify is retail, not this product | A later ticket adds a retail channel into Catalog/Sales |

### G18. Already listed as “open on the call”

From [`database-design.md`](./database-design.md), still open and restated here so they are not lost:

1. Invoice on **confirm** or on **ship**? → **closed: on ship** ([G7](#g7-invoice-on-confirm-vs-on-ship))
2. Separate **cart** table, or draft **orders**? → [G5](#g5-sales-order-state-machine)
3. Day-one documents: credit memo, RMA, blanket PO? → default **none in v1**, named in [§17](#17-v1-scope-locks-explicitly-deferred)
4. On-shelf only vs buy against inbound / before a factory PO? → **closed: David's formula** ([ADR 0008](./adr/0008-available-to-sell-open-locked.md), I6)

### G19. Licensing policy (subscription, grace, core vs paid)

The seam is locked ([§10b](#10b-licensing-software-subscription-and-flags), [`licensing.md`](./licensing.md)). These **policies** are not:

- Which `FeatureName`s are **core** vs first paid packs (start core = entire v1 product; paid catalog empty until a real add-on is sold).
- What happens when subscription is `past_due`: grace period length, read-only staff vs hard paywall, whether ops still works (recommended: ops always works for operator; staff read-only after grace).
- Trial length, if any.
- Stripe vs manual-only for first go-live.
- Whether `apps/ops` ships in the first deploy or the operator uses a stub `/ops` API until the UI exists.

**Close before Licensing is more than `IFeatures` always-on:** past_due behavior and the core flag list. Stripe can wait if manual `SoftwarePayment` is tested.

### G20. Operator platform ingest (when you wire the other repo)

The **door** is locked ([§10c](#10c-operator-platform-bridge), [`operator-bridge.md`](./operator-bridge.md)). Before flipping no-op → HTTPS:

- Ingest URL + auth (HMAC/shared secret in env).
- Heartbeat cadence and fields (keep it a snapshot, not APM).
- Whether wholesale users may submit issues (default **no**).
- Replay policy for `forward_failed` outbox rows.

Until then, no-op is the correct v1 adapter.

### G21. Hosted tax engine (AvaTax vs cheaper)

Calculation + commit is locked ([§10a](#10a-tax-quote--commit), [`tax.md`](./tax.md)). The **vendor** is not:

- Default: Avalara AvaTax (wholesale resale certificates).
- Acceptable cheaper: Stripe Tax only if few-nexus and staff will store certificates themselves.

**Close before the production adapter is wired:** which engine, sandbox credentials, and the entity-use / resale codes for this company’s customers. In-memory tests do not wait on that pick.

### Suggested owner-test packets once P0 items close

These are the failing tests the architecture already says the owner writes; they cannot be honest until the gaps above have defaults:

1. **Inventory:** movement effects, `available = on_hand − allocated`, locked `availableToSell = on_hand + on_order − committed`, open SKU has no sellability cap, first `InboundFromPo` locks, sell window can lock with no PO (injected clock), reject locked oversell under concurrent confirms (in-memory lock/serial), cover FIFO on receive, adjustment sign, compensating decommit/deallocate.
2. **Sales confirm:** all-or-nothing `availableToSell` on locked lines, credit formula, session `customerId` overwrite, snapshot price frozen, draft not commitable twice. Ship only against `Allocated`.
3. **Purchasing receive:** `GoodsReceived` vs remaining `on_order`, cancel-compensates inbound (does not reopen), over-receive rejected, FIFO cover of committed qty.
4. **Accounting:** invoice on ship, partial payment, cannot over-apply, `Money` integer-only; invoice total includes committed tax.
5. **Tax:** quote ≠ commit; fail-closed on engine error; commit idempotent; posted invoice tax lines do not change when a later quote would; no tax HTTP inside inventory lock.
6. **Identity:** wholesale cookie rejected on `/internal`, `customerId` in body ignored, 404 for another customer’s order.
7. **Licensing:** paid flag false without grant; operator force-off wins; business owner cannot write overrides; duplicate `provider_ref` does not double-grant; Accounting tests never read `software_payments`.
8. **Operator bridge:** software payment still commits if publish throws; issue submit succeeds on local save; closed message kinds only.

---

## 19. PR review map

When reviewing an agent PR, the architecture checklist still applies ([architecture.md §15](./architecture.md#15-dependency-checklist)). Extra questions this document adds:

- [ ] Did the slice invent a qty write, a second sellability formula, or a cart-side reservation?
- [ ] Did it treat warehouse `available` as available to sell, or compute either in a frontend?
- [ ] Did a status change skip a movement (cancel without `Decommitted`/`Deallocated`, receive without `GoodsReceived`, confirm without `Committed`)?
- [ ] Did money or qty become float anywhere on the path (DB, DTO, CSV, chart)?
- [ ] Did wholesale trust a body `customerId` or return another customer’s row as `403`?
- [ ] Did software billing land in Accounting or Catalog, or did a flag skip ATP/authz?
- [ ] Did a slice multiply a tax rate, post an invoice without `ITaxCalculator.commit`, or treat a quote as the legal amount?
- [ ] Did a slice require the operator platform to be online for inventory or checkout?
- [ ] Did the change close a [§18](#18-what-the-initial-plan-still-needs) gap **in code** without updating this file and owner tests?
