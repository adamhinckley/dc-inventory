# Multi-organization (future)

A second wholesale **company** signing up on the same website and getting to work. **Not v1.** Must stay additive: a migration and an Identity/session packet, not a new database product or a rewrite of the ledger.

Related: [`../architecture.md`](../architecture.md) · [`../stack.md`](../stack.md) · [`../database-design.md`](../database-design.md)

---

## Language

**Organization** — the wholesale business that uses this software (staff, catalog, stock, suppliers, POs). v1 has exactly one, implicit.

**Customer** — a buyer **of that Organization**: terms, credit, contacts, orders, invoices. Not the SaaS account.

**Wholesale user** — a login bound to one Customer (and, later, that Customer’s Organization).

**Staff user** — a login for people who work at an Organization.

Do not use “account” for both the SaaS tenant and a wholesale buyer.

v1 already isolates **Customers of one Organization** from each other (session `customerId` on `/wholesale/*`). It does **not** isolate two Organizations sharing one database.

---

## What v1 is

One customer organization: a multi-employee wholesale company. One Postgres. Staff share one catalog and one stock ledger. Many wholesale clients log into the shop scoped to their `CustomerId`.

That is enough for the first company. A second company today would be a **separate deploy** (or they would see each other’s catalog and stock). Self-serve signup is later.

---

## Target later: signup on the same site

When another wholesale business with the same needs appears, they create an Organization and a first staff user on `whatever.com` and start work.

**How data is isolated:** one Fastify, one Postgres, `OrganizationId` on every aggregate. Session binds `organizationId` for staff (same overwrite rule as `customerId` today). Shop session binds `organizationId` + `customerId`. List and report queries take org from the session, never from the client body.

**Not the path for signup:** a database per company. Same hostname *can* route to different DBs, but login does not know which database holds the password until it knows the company — you then need a shared directory (email or slug → connection), a pool per tenant, and migrations/backups N times. That is provisioning, not a signup form. Subdomains (`acme.whatever.com`) make “which DB?” easier; a single hostname does not. Do not stand up a second Postgres “for when we have tenants.”

RLS stays optional defense-in-depth, not the v1 (or first multi-org) gate — same as [`../stack.md`](../stack.md).

---

## v1 seam (so later is not a blocker)

Treat Organization like `LocationId`: one implicit org now (`DEFAULT`). No signup UI. No second database.

Do in v1, or as soon as tables are real:

| Seam | Why |
| --- | --- |
| `OrganizationId` in the shared kernel; composition root uses one constant | Same pattern as `LocationId = DEFAULT` |
| Unique SKU is `(organization_id, sku)`, not global `sku` | Two companies can both sell `WIDGET-1` |
| Staff belong to that org; session can grow `organizationId` | Wholesale already overwrites `customerId` |
| Object storage keys prefixed by org | Images and PDFs must not be guessable across companies |
| Unique shop (and staff) email is `(organization_id, email)`, not global `email` | See [same buyer, two sellers](#same-buyer-buying-from-two-organizations) |

Do **not** freeze: global unique SKU / vendor number, staff with no home org, reports that `SUM` the whole database, a global “party” table for buyers.

---

## Same buyer buying from two Organizations

Acme Retail can buy from Wholesale A and Wholesale B. That must **not** be one `CustomerId`.

A Customer is “this buyer’s account with **this** seller”: credit, terms, orders, invoices. Two sellers → two Customer rows. Sharing one id across orgs would mix money and order history. Catalog and stock they order from are always the seller’s.

The same legal name, tax id, or contact email may appear in both orgs. That is coincidence (or a later typed-twice convenience), not a join.

**The uniqueness trap:** if `wholesale_users.email` is unique for the whole database, the second Organization cannot invite `buyer@acme.com`. Keep uniqueness per Organization. The same person then has two shop logins. One login that shops at many wholesalers is a separate identity product — not required for signup-and-work.

v1 has one Organization, so this scenario cannot happen yet. When `OrganizationId` lands, keep Customers and wholesale users under the org. Do not build a shared buyer directory in order to “dedupe” Acme.

---

## Later packet (when an owner opens it)

1. `RegisterOrganization` use case: Organization + first staff user.
2. Identity binds `organizationId` on both session cookies; wholesale still overwrites `customerId`.
3. Every repository `WHERE` includes org. Unique constraints are composite.
4. Shop may stay `shop.whatever.com` with org in session after login, or `org.whatever.com` if the tenant should be in the URL.
5. Still one API and one Postgres unless a real ops reason appears for a dedicated database.

Owner-gated like inventory math and `customerId` binding ([`../architecture.md`](../architecture.md) §10).
