# Customers (v1 master)

Companion to [`architecture.md`](./architecture.md). That document is the module map. This one is **how the wholesale buyer account is stored, created, and gated** so staff can onboard a customer and Sales / Accounting can snapshot the right addresses without re-grilling.

Related: [`invariants.md`](./invariants.md) (§9 U1–U14) · [`database-design.md`](./database-design.md) (tables) · [`api-contract.md`](./api-contract.md) (internal vs wholesale DTOs) · [`tax.md`](./tax.md) (no sales tax) · [`CONTEXT.md`](../CONTEXT.md) § Customers (glossary only).

Wayfinding map: [Customer master data model map](https://linear.app/adamhinckley/issue/ADA-243/customer-master-data-model-map) (decisions closed; this doc is the handoff).

v1 currency is **USD** (`Money.currency` stays; operations are one currency). Every customer is a **reseller** — this company does not sell to taxable end-users. There is **no tax status** on the customer header.

---

## 1. Shape: one header, child records

```mermaid
flowchart LR
  subgraph customers [Customers context]
    Header["customers header"]
    Contacts[contacts]
    ShipTos[ship_tos]
    BillTo[bill_tos]
    Certs[exemption_certificates]
  end
  subgraph callers [Callers hold IDs or snapshots]
    Sales[Sales orders]
    Acct[Invoices]
    Identity[Wholesale users]
  end
  Header --> Contacts
  Header --> ShipTos
  Header --> BillTo
  Header --> Certs
  ShipTos -.->|snapshot at confirm| Sales
  BillTo -.->|snapshot at ship| Acct
  Header -->|CustomerId| Sales
  Header -->|CustomerId| Acct
  Identity -->|customer_id| Header
```

| Piece | Owns | Does not own |
|---|---|---|
| **Customers** | Account header, contacts, ship-to, bill-to, exemption files + metadata, terms field, credit-limit field, notes, account status | Invoices, sales-tax math, shop login, order history |
| **Sales** | `CustomerId`, ship-to snapshot on the order at confirm | Live ship-to FK after confirm; bill-to |
| **Accounting** | Invoice AR; bill-to snapshot on the invoice at ship; due date from terms | Customer CRUD |
| **Identity** | Wholesale user ↔ `CustomerId` binding at login | Contact rows (contact email ≠ shop user) |

Sales and Accounting hold `CustomerId`, not a Customer aggregate (C4–C5). Credit enforcement at confirm uses `ICreditCheckPort`, not a cross-schema join in Sales (U2).

---

## 2. Customer header

| Field | Required at create | Notes |
|---|---|---|
| **Business name** | Yes | Commercial identity |
| **Terms** | Yes | Payment clock; copied to invoice due date at ship (A2). Free text in v1; Net 30/60/90 enum is still open — see §12 |
| **Credit limit** | Yes | `Money`; `$0` is valid and means **no credit** (card / prepay only). Formula: [`accounting.md`](./accounting.md) §7. Editing it is the `credit_limit_manage` action (G8) |
| **Customer number** | No (see §3) | Always present after save |
| **Tax ID** | No | Optional reseller identifier on the account |
| **Account status** | No (defaults `active`) | `active` \| `on hold` \| `inactive` — see §8 |
| **Customer note** | No | Empty allowed — see §7 |
| **Staff note** | No | Empty allowed — see §7 |

**First save** is header-only (`POST /customers`). Contacts, ship-tos, bill-to, and exemption certificates use separate endpoints afterward. Default org-wide values for terms and credit limit at create are **not** locked — ask David (§12).

---

## 3. Customer number

Human-readable identifier, unique per organization. Not the UUID `CustomerId`. Visible on **both** internal and wholesale apps (invoices, order history).

| Create input | Result |
|---|---|
| Blank | Customers context assigns next `CUST-#####` (prefix `CUST-`, five-digit pad — same family as `SO-` / `INV-` / `PO-`) |
| Staff-supplied string | Stored as given (migration from a prior system); any non-empty string unique per org |

Immutable after first save on both paths. Bulk import is out of scope for this spec.

---

## 4. Contacts

One or more per customer. Fields: name, email (required), phone (optional). Email is **unique per customer** (not globally).

Contact email is **not** the wholesale login. Identity owns shop users bound to `CustomerId` at login.

**Not required at create.** Which contact receives confirmation or invoice email when several exist is still open — see §12.

---

## 5. Ship-to

One or more destination addresses per customer. Same six fields as today: `line1`, `line2`, `city`, `region`, `postal`, `country`, plus `is_default`.

- Staff may maintain many ship-tos; one may be default.
- **Not required at create.** Confirm needs a ship-to snapshot on the order — staff finish addresses before the first order (or pick at confirm).
- Sales copies the six address fields onto the order at **confirm** (typed snapshot; no live `ship_to_id` on the order).

Staff may **copy default ship-to into bill-to** as a stored duplicate; rows diverge independently afterward (not a live pointer).

---

## 6. Bill-to

**Separate** from ship-to. One row per customer in `bill_tos` (same six address fields; **no** `is_default`; unique on `customer_id`).

| Moment | Rule |
|---|---|
| Create | May be absent |
| Confirm | Does **not** require bill-to |
| Ship | **Refuses** if no bill-to — no shipment, no invoice; staff add bill-to and retry |
| Invoice post | Copies the six bill-to fields onto the invoice (frozen snapshot) |

Sales order does **not** carry bill-to. Only the invoice snapshots it at ship.

---

## 7. Notes

Two distinct free-text fields on the header — not a thread, not one field with a visibility flag.

| Field | Internal app | Wholesale app | Who writes (v1) |
|---|---|---|---|
| **Customer note** | Read | Read | Wholesale customer only (session `customerId`) |
| **Staff note** | Read + edit | **Omit** from wholesale OpenAPI | Staff who can manage customers |

Empty allowed on both. Do not copy either note onto sales orders or invoices.

---

## 8. Account status

`active` \| `on hold` \| `inactive`. Defaults **`active`** on create; staff may set hold or inactive when creating (e.g. migrating a closed account) but are not forced to pick.

Hold is a staff override, not an AR projection. Credit-limit formula (G6) is separate.

| State | Block | Allow |
|---|---|---|
| **On hold** | New confirm; staff place-on-behalf | Edit draft/cart; wholesale login; record payment |
| **Inactive** | New confirm; new drafts/cart; wholesale login; staff place-on-behalf | Record payment on internal app; ship already-confirmed orders |
| **Both** | — | Ship of **already-confirmed** orders (demand committed; bill-to gate still applies) |
| **Active** | — | Everything |

---

## 9. Exemption certificates

Child records on the customer. **No tax status** on the header — every customer is a reseller; this app does not calculate sales tax ([`tax.md`](./tax.md)).

| Field | Required on the row |
|---|---|
| Jurisdiction | Yes |
| Entity-use code | No |
| Expiry | No |
| File (`object_key`) | No |

Wholesale customer or staff may upload the file. Metadata-only rows (no file) are valid.

**Not a gate:** customer may exist, confirm, and ship with zero certificates or only expired ones. Missing/expired is visible only — no auto-flip, no confirm block in v1.

Research on what “wholesale license” actually is, Alabama MAT verify, and gate-vs-evidence: [`wholesale-resale-license-onboarding.md`](./wholesale-resale-license-onboarding.md). Do not flip this gate from that note.

**Not required at create.**

---

## 10. Gates summary

| Gate | Requires |
|---|---|
| Create customer (first save) | Name, terms, credit limit |
| Add contact / ship-to / bill-to / cert | Customer exists |
| Confirm order | Ship-to chosen/snapshot; account status allows; credit check (G6); ATP — not bill-to, not cert |
| Ship order | Bill-to exists on customer |
| Post invoice | Ship succeeded |

---

## 11. Surfaces (internal vs wholesale)

| Data | Internal | Wholesale |
|---|---|---|
| Header + customer number | CRUD (staff) | Read own account |
| Terms, credit limit | Read/write (staff) | Read own (typical shop) |
| Staff note | Read/write | Hidden |
| Customer note | Read | Read + edit own |
| Contacts | CRUD | Read own |
| Ship-tos | CRUD | CRUD own |
| Bill-to | CRUD | Read own |
| Exemption certs | CRUD + upload | Read + upload own |
| Account status | Read/write (staff) | Effect only (login/confirm gates) |

Exact wholesale write scope for contacts/addresses follows [`api-contract.md`](./api-contract.md) when wired; gates above are domain truth. UI/IA for list, detail, wholesale `/account`, and the `/sales` Customer link: [`surfaces/customer-account.md`](./surfaces/customer-account.md).

---

## 12. Still open (do not invent in implementation packets)

| Topic | Owner / next step |
|---|---|
| Default values for terms and credit limit at create | Ask David |
| Terms free text vs Net 30/60/90 enum | Product call (G13 successor) |
| Which contact gets confirmation / invoice email | Product call |
| Confirmation email send (`IEmailSender`) | Deferred send-job; confirm use case owns the port when built |
| Statements | PDF projection + `IEmailSender` later — [`accounting.md`](./accounting.md) §9; do not overload Invoice |
| Credit-limit **formula** (G6) | **Closed** — [`accounting.md`](./accounting.md) §7; enforcement is a Sales packet |
| Bulk customer import | Out of scope |
| Implementation migration, OpenAPI, demo seed | Separate work packet after this spec |
| **Onboarding — three tiers** (pending until approve, staff-for-them, Tier 1 org) | Locked destination — see §15. Map: [DCI-406](https://linear.app/adamhinckley/issue/DCI-406). Supersedes [DCI-413](https://linear.app/adamhinckley/issue/DCI-413) account-request docs packet |

---

## 13. What agents may do

| High autonomy | Owner-gated |
|---|---|
| Header CRUD shape, contacts, ship-tos, bill-to CRUD | Credit-limit formula (G6) |
| Certificate file upload + metadata | Account-status enforcement wiring in Sales/Identity |
| Internal vs wholesale DTO mapping (omit staff note wholesale) | Default terms/credit limit until David locks |
| In-memory adapters for all Customers ports | Changing locked U* rules in `invariants.md` |

Do not implement schema, HTTP, or dashboard forms in the wayfinding map session. The implementation packet reads this doc + `database-design.md` + failing owner tests for U5–U14.

---

## 14. Implementation order (customers slice)

Fits [`architecture.md` §13](./architecture.md#13-implementation-order-when-coding-starts). Packets: [ADA-260](https://linear.app/adamhinckley/issue/ADA-260/implement-customer-master-customers-context) → [ADA-261](https://linear.app/adamhinckley/issue/ADA-261/sales-refuse-ship-when-bill-to-missing) → [ADA-262](https://linear.app/adamhinckley/issue/ADA-262/accounting-snapshot-bill-to-on-invoice-at-ship); status gates after 260 as [ADA-263](https://linear.app/adamhinckley/issue/ADA-263/enforce-account-status-gates-sales-identity) (Sales) and [ADA-264](https://linear.app/adamhinckley/issue/ADA-264/identity-wholesale-login-vs-account-status) (Identity).

1. Owner tests encode U5–U9 and U11–U14 in Customers; owner tests encode U10 in Sales and Identity (not in the Customers CRUD packet).
2. Customers migration only: header columns, `bill_tos`, `CUST-` document counter. **Not** invoice snapshot columns.
3. Domain + use cases: create (two number paths), bill-to, status field, notes. Export read ports (bill-to snapshot, account status) for other contexts — not the Customer aggregate.
4. HTTP + OpenAPI: internal full; wholesale own-account read + customer-note edit; omit staff note.
5. Demo seed updates for named customers.
6. Sales ship gate (261), Accounting invoice snapshot columns + copy at ship (262), Sales U10 (263), Identity wholesale login (264).

---

## 15. Onboarding — three tiers (locked destination)

**Supersedes:** Customer-on-submit / on-hold-on-register destination from [DCI-412](https://linear.app/adamhinckley/issue/DCI-412) / [DCI-411](https://linear.app/adamhinckley/issue/DCI-411) and the account-request docs packet [DCI-413](https://linear.app/adamhinckley/issue/DCI-413) — both replaced by this section ([DCI-421](https://linear.app/adamhinckley/issue/DCI-421)). Implementation map: [DCI-406](https://linear.app/adamhinckley/issue/DCI-406/onboarding-three-tiers-map). Linear project: **Onboarding — three tiers** (folds the former account-request project).

Three separate doors, in order. David today is tier 2 of the first tenant (`DEFAULT`). The next company is a new tier-1 org, then their David, then their people.

| Tier | Who acts | What is created |
|---|---|---|
| **1. Business** | Ops on **`DEFAULT` / platform only** | `Organization` + first staff `admin` (invite, not password-on-form) |
| **2. Super user** | That first admin (David-shaped) | They **are** the result of tier 1. G8 `admin`. Not a new role. |
| **3. Staff + customers** | That super user | More `StaffUser`s (roles at create) and customers via **pending until approve** or **staff-for-them** |

Prototype PR [#305](https://github.com/adamhinckley/dc-inventory/pull/305) is **throwaway** — not a docs or shipping pattern. Live SoloView’s PandaDoc wholesale agreement is observed legacy only; this destination does **not** model PandaDoc or a signature provider.

### Tier 1 locks

| Lock | Rule |
|---|---|
| `organizations_manage` | **`DEFAULT` / platform only** — not every tenant admin ([`invariants.md`](./invariants.md) G8) |
| Org slug | Company **display name → editable derived slug** — not a free-typed slug as the primary input |
| First admin | **Display name + email**; **invite**, not password-on-form |
| Display names | Required on staff, wholesale, and ops users + `organizations.name` |
| Password | Set-password only: **8+ characters**, upper, lower, number (shared validator) |
| Invites | `IEmailSender`; local dev uses **Mailpit** in Compose |

### Tier 3 — customers: pending until approve

**Public apply** (wholesale `/register` when wired): stores a **Pending application** — **not** a `Customer`. Buyer sees pending success; no shop login yet. Do not invent an `AccountRequest` aggregate name — the pending store is its own row, distinct from the customer header.

**Staff review:** internal **`/customers/applications`**. Business name opens full detail; **Approve** / **Reject**.

| Action | Result |
|---|---|
| **Approve** | Creates `Customer` **`active`** with terms + credit limit; exemption cert with **jurisdiction + number** (U13 evidence — not a gate); `WholesaleUser` bound to that customer; **invite** email (not password-on-form) |
| **Reject** | **No `Customer` created.** Pending row closed with no downstream records |
| **Staff-for-them** (`admin`) | Same end state as Approve **without** a prior pending row — admin creates customer + wholesale login + invite on the internal dashboard |

**Who may (tier 3):** `staff_manage` and wholesale login creation are **`admin` only** ([DCI-409](https://linear.app/adamhinckley/issue/DCI-409)). `purchasing` may create `Customer` headers via existing `master_data_manage` but may **not** create shop logins.

**U10 unchanged:** `active` / `on hold` / `inactive` gates buy and confirm as locked in §8. Pending is **not** a fourth customer status — no `Customer` exists until approve.

**U13 unchanged:** exemption certificates are evidence only — not a create/confirm/ship gate. On the approve path, collect **jurisdiction + number** only. **No exemption certificate file upload** in this wave. What the number represents (Alabama Sales Tax License vs STE-1 vs out-of-state) stays open — [`wholesale-resale-license-onboarding.md`](./wholesale-resale-license-onboarding.md).

**Deferred this wave:** existing-account “register for web access” bind flow ([DCI-419](https://linear.app/adamhinckley/issue/DCI-419)); cert verification / flipping U13 ([DCI-399](https://linear.app/adamhinckley/issue/DCI-399)).

Header **terms** (payment clock) are set at approve or staff-for-them — not on the public apply form. They are not a legal wholesale agreement document.

| What exists today | What this destination adds (packets after this doc lock) |
|---|---|
| Staff create a `Customer` (U5); status defaults `active` | Pending application store distinct from `Customer` |
| `active` / `on hold` / `inactive` (U10) | Approve / reject / staff-for-them paths — no fourth status |
| Wholesale `/register` is mailto | Public apply → pending; internal review at `/customers/applications` |
| No wholesale login / invite path | Approve or staff-for-them → `WholesaleUser` + invite |
