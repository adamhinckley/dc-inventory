# Licensing: software subscription, paid add-ons, and feature flags

Companion to [`architecture.md`](./architecture.md). Wholesale **Accounting** is the company invoicing *its* customers. This document is the other money: the wholesale company paying the **software operator** (developer) for the product, plus the flags that turn paid capability on.

Related: [`invariants.md`](./invariants.md) (L1–L12, G19) · [`stack.md`](./stack.md) (Stripe as an adapter) · [`api-contract.md`](./api-contract.md) (ops spec vs internal/wholesale).

This is architecture. Stripe wiring and a polished ops UI come after the ports and tests exist.

---

## 1. Why this is its own context

Two books, two ubiquitous languages. Mixing them is how agents will “just add a payment row” onto customer AR.

| Book | Payer | Payee | Context | Appears in |
|---|---|---|---|---|
| **Customer AR** | Wholesale customer | The wholesale company | **Accounting** | `apps/internal` invoices; maybe `apps/wholesale` “my invoices” |
| **Software subscription** | The wholesale company (the tenant) | The **developer** / software operator | **Licensing** | `apps/ops` only |

Licensing also owns **paid additions** (feature packs you can sell later) and the **feature-flag read model** every other context consults. It does **not** own catalog products, stock, or customer credit.

`TenantId` exists from day one and is currently `DEFAULT` (same additive trick as `LocationId`). Multi-tenant SaaS is not v1; the grain is already there.

---

## 2. Audiences

| Actor | Who | Where they work | What they can do |
|---|---|---|---|
| **Operator** | You (solo software operator) | `apps/ops` | Full: flags, complementary entitlements, payment history, record a manual payment, Stripe (when wired) |
| **Business owner** | One or a few people at the wholesale company | `apps/ops` | View subscription + **payment history**, buy/cancel add-ons, **not** force-enable unpaid flags |
| **Staff** | Warehouse / purchasing / sales support | `apps/internal` | Consume entitlements. Cannot open ops. Cannot flip flags. |
| **Wholesale user** | Client shop login | `apps/wholesale` | Consume entitlements. Cannot buy software add-ons. |

“I or the business controls flags” means **ops**, not the staff dashboard and not the shop. Staff may see “this feature is not on your plan.” They do not administer it.

Identity grows a third actor type: **`OperatorUser`**. Business owners are **not** staff with a hidden role. They authenticate on the ops origin with an ops session. (A person who is both staff and owner has two logins or an explicit link — do not reuse `staff_session` on `/ops`.)

---

## 3. Shape: port first, dashboard extractable

v1 stays one API process and one Postgres (solo ops). The **ops UI can move** later without rewriting Catalog/Sales.

```
apps/ops  (or a later separate deployable)
    → HTTP adapter /ops/*
        → Licensing use cases
            → IFeatures / IEntitlementRepository / ISoftwareBillingGateway
```

Write path for flags and entitlements is **Licensing ports**, not `UPDATE` from a random controller and not LaunchDarkly as the domain.

| v1 | Later (adapter swap, same ports) |
|---|---|
| `apps/ops` in this monorepo, cookie `ops_session`, origin allowlisted | Same UI deployed separately, still calling `/ops` |
| Postgres is the flag/entitlement source of truth | `IFeatures` adapter that reads an external flag service |
| `ISoftwareBillingGateway`: **record manual payment** + in-memory fake | Stripe Billing + Customer Portal + webhooks |

Do **not** require LaunchDarkly, Stripe, or a second deployable to start. Do **not** put a flags SDK in `domain/` or in every React page.

---

## 4. Bounded context

```
packages/licensing/
  domain/         # TenantId, Plan, Subscription, AddOn, Entitlement, SoftwarePayment, FeatureName, ports
  application/    # evaluate flags, record payment, apply webhook, grant complementary add-on
  adapters/       # Postgres, Stripe, in-memory, HTTP /ops
  tests/unit/
```

| Owns | Does not own |
|---|---|
| Plan, subscription status, add-on catalog (software packs), entitlements in force | Wholesale `Customer`, sales orders, inventory qty |
| **Software payment history** (money the tenant sent the developer) | Accounting invoices / `payment_applications` |
| Feature flag **evaluation** and operator **overrides** | Staff RBAC (Identity), “is this SKU sellable” (Catalog + Inventory) |

### Aggregates

- **Subscription** (per tenant): plan, status (`trialing` \| `active` \| `past_due` \| `canceled`), period bounds, billing-provider ids (opaque strings, not Stripe types).
- **AddOnGrant**: which paid packs this tenant has (purchased or complementary).
- **SoftwarePayment**: append-only history. Amount is `Money`. Status `pending` \| `succeeded` \| `failed` \| `refunded`. Optional provider event id for idempotency.
- **FlagOverride**: operator force-on / force-off for one `FeatureName`. Business owners cannot write these.

### Ports

| Port | Direction | Adapters |
|---|---|---|
| `IFeatures` | Read — every driving adapter may call | Postgres projection, in-memory |
| `IEntitlementRepository` | Write/read subscription + grants | Postgres, in-memory |
| `ISoftwarePaymentRepository` | Append + list history | Postgres, in-memory |
| `ISoftwareBillingGateway` | Charge / portal / webhook | Stripe, **manual record**, in-memory |
| `IFeatureFlagAdmin` | Operator overrides | Postgres, in-memory |

Other contexts **import `IFeatures` and `FeatureName` only**. They never import `Subscription` or Stripe. Same anti-corruption rule as Sales vs Catalog.

`FeatureName` is a **closed typed catalog** in Licensing (string union / const array). Agents do not invent `"newFlag"` in a controller. Adding a paid capability is: add the name → map it to a plan or add-on → gate the HTTP/use-case edge → UI reads the bootstrap list.

---

## 5. Feature flags: easy to plumb, hard to abuse

### Evaluation (locked)

For a tenant, `IFeatures.isEnabled(name)`:

1. Operator **override** (force off wins over force on if both exist — pick one and test it; recommended: force off wins).
2. Else if the name is in the **core** set: enabled iff subscription is `trialing` or `active` (grace: [G19](./invariants.md#g19-licensing-policy)).
3. Else enabled iff an **in-force entitlement** (plan or add-on grant) includes that name.
4. Else **false**.

Core flags are the v1 product (catalog, inventory, purchasing, sales, customers, AR). Paid add-ons start empty and grow (example names, not a promise): `pack.spreadsheetImport`, `pack.advancedReports`, `pack.extraUsers` — only when a real pack is sold.

### Where to check

| Allowed | Forbidden |
|---|---|
| HTTP adapter or a use-case **decorator** at the composition root before `execute` | Inside Inventory ledger math, ATP, credit formula, `customerId` overwrite |
| UI nav/hide from **bootstrap** (`GET …/features`) | Computing flags in the browser from plan names, prices, or localStorage |
| `403` (or a documented `402`/`payment_required`) if someone calls a gated route anyway | Trusting the UI hide as security |

Frontends call a small bootstrap on session load. They do not ship a flags SDK. Internal and wholesale **must not** expose flag **admin**.

### Plumbing a new flag (agent work packet)

```
1. Owner adds FeatureName + default mapping (core vs add-on) in licensing tests
2. Agent gates the route/use case with IFeatures
3. Agent hides the nav item when bootstrap omits the name
4. Do not change ATP, AR, or authz invariants to “make the flag work”
```

---

## 6. Paid add-ons

An add-on is a **Licensing** product (`AddOnId`, display name, `Money` price, set of `FeatureName`s). It is **not** a Catalog `Product` and **not** a `Sku` in Inventory.

Flow:

1. Business owner (ops) or operator starts checkout via `ISoftwareBillingGateway`, **or** operator records a complementary grant (no charge).
2. On success, append `SoftwarePayment` (if money moved) and insert `AddOnGrant`.
3. `IFeatures` projection updates in the **same transaction** as the grant (v1 — no “eventual flag”).
4. Staff/wholesale pick up the new flag on next bootstrap (or a documented short cache; v1: no cache).

Cancel/revoke grant: remove entitlement; flags go false; in-flight staff work is not rolled back (do not deallocate stock because an add-on lapsed).

---

## 7. Payment to the developer

The merchant is the **software operator**. The tenant is the customer of the software. There is no Stripe Connect split in v1 (not a marketplace).

**Never store card PANs.** Same rule as Accounting.

### Software payment history (required)

`licensing.software_payments` is the record the ops dashboard lists. Columns conceptually: id, tenant_id, amount (`BIGINT` cents), currency, status, kind (`subscription` \| `add_on` \| `manual`), occurred_at, provider (`stripe` \| `manual`), provider_ref (unique when present), memo.

This table is **not** `accounting.payments`. No FK from a software payment to a wholesale customer invoice.

### Gateway

- **Manual (v1-capable):** operator records “received wire/check on date for plan/add-on.” Tests can run without Stripe.
- **Stripe (adapter later):** Checkout or Billing for subscription + add-ons; Customer Portal for the business owner; **webhooks** are the source of truth for provider-originated status. Idempotency key = Stripe event id (unique on `provider_ref`). Domain still sees `SoftwarePayment`, not `Stripe.Event`.

Webhook signature verification lives in the **adapter**. Failed signature = 400, no domain call.

---

## 8. HTTP: third driving adapter

```
/internal/...    staff_session
/wholesale/...   wholesale_session
/ops/...         ops_session     ← operator + business owner
```

Three origins, three cookies, three OpenAPI specs. CORS allowlists **exactly** those origins. An ops session is rejected on `/internal` and `/wholesale`, and vice versa.

`/ops` includes: login, subscription view, payment history, add-on catalog + checkout/manual grant, flag override (operator only). It does **not** include inventory, catalog CRUD, or staff DataTables.

Webhook endpoint (e.g. `POST /ops/webhooks/stripe`) is **not** cookie-auth; it is adapter-verified. Do not put it on the wholesale spec.

Bootstrap (read-only flags) **does** belong on internal and wholesale session routes so UIs can hide nav — a list of enabled `FeatureName`s, not the entitlement admin model.

---

## 9. Identity additions

| Actor | Bound at login | Never trust from the body |
|---|---|---|
| Operator | `operatorUserId` | “make me owner”, flag names to force-on without going through `IFeatureFlagAdmin` |
| Business owner | `opsUserId` + `tenantId` | complementary grants, force-on overrides |

Keep the ops user table in **Identity** (credentials/sessions). Licensing holds `tenantId` on the subscription. Identity does not store plan prices.

Rate-limit `/ops/auth/*` like the other auth routes.

---

## 10. Autonomy and tests

| Slice | Autonomy |
|---|---|
| `IFeatures` in-memory + “gate this route” once the name exists | High |
| Ops UI tables for payment history against existing list protocol | High |
| Postgres mapping for entitlements | Medium |
| Subscription state machine, Stripe webhook → payment, complementary vs paid grants | **Low** — owner tests first |
| Which flags are core vs paid | Owner catalog, not an agent invention |

Owner-written tests (when this slice is built):

- Core use cases stay available when subscription is `active`; a paid flag is false without a grant.
- Operator force-off disables a flag even if the add-on is granted.
- Business owner cannot write `FlagOverride`.
- Manual payment appends history and grants the add-on in one transaction.
- Duplicate webhook / duplicate `provider_ref` does not double-grant.
- Accounting payment tests do not read `software_payments`.
- Inventory tests do not stub flags to skip ATP.

---

## 11. Explicitly not this context

- Customer AR, statements, credit limits
- Storing cards; becoming a payment facilitator for wholesale customers’ cards
- LaunchDarkly / Statsig / Unleash as a required runtime (allowed later **as** `IFeatures`)
- Per-request remote flag lookup on the inventory hot path (evaluate in-process from our projection)
- Using feature flags to “temporarily allow oversell” or skip `customerId` binding
- Selling add-ons through the wholesale shop as if they were inventory SKUs
