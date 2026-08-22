# Tax engine (design note)

**Superseded for v1 scope:** quote/commit tax is on the v1 path in [`tax.md`](./tax.md). Keep this note for the port + snapshot shape; do not treat “not v1” below as current.

How sales tax would work in this architecture. Do not sneak a tax percent onto `customers` or compute tax in React.

Related: [`architecture.md`](./architecture.md) (AR-only accounting, snapshots, two HTTP adapters) · [`database-design.md`](./database-design.md) · [`api-contract.md`](./api-contract.md)

---

## What it is

A **tax engine** is a rules service that answers: *how much tax on this order, right now, for this ship-to, this origin, these SKUs, this customer’s exemption status?*

It is not:

- A column the frontend multiplies at checkout
- A live join back to Avalara when someone reprints a 2024 invoice
- Inventory (quantities) or Catalog (list price)

It is another **money snapshot**, next to unit price: freeze the quote when the order (or invoice) becomes a financial document.

This business is **wholesale**. The common case is **exemption** (resale certificate → $0 tax, but you still record *why*), not a single shop-wide rate. Taxable ship-to, mixed SKU taxability, and freight are the hard cases.

---

## When it runs

Call the engine at the **same moment you freeze money** — the Accounting policy already in play:

| Invoice policy (pick one) | Tax is quoted |
| --- | --- |
| Invoice on **confirm** | At sales-order confirm, using ship-to on that order |
| Invoice on **ship** | At ship / invoice create, using the ship-to actually used |

Do not quote at confirm and invoice at ship to a **different** address without a re-quote. Mixed policies are how tax filings and invoices disagree.

Wholesale checkout may show an **estimate** only if ship-to is already known and the wholesale OpenAPI includes it. The browser never computes tax; it displays the quote from the use case.

---

## Where it sits

```
Sales confirm (or Accounting invoice)
  → ICreditCheckPort (existing)
  → ITaxCalculator.quote(TaxableOrder)     ← new port
  → persist TaxQuote on the order/invoice
  → Inventory allocate (unchanged)
```

| Piece | Owns |
| --- | --- |
| **Port** `ITaxCalculator` | Application boundary. Domain does not import Avalara/TaxJar/Stripe. |
| **Adapter** | Vendor SDK, or a fake in unit tests, or a tiny “exempt / single rate” table for a one-state start |
| **Sales / Accounting** | When to call; persist snapshot; invoice total = merchandise + tax |
| **Customers** | Exemption status + certificates (not the rate table) |
| **Catalog** | SKU taxability code if we need more than “always goods” |
| **Inventory** | Nothing. Tax does not write qty. |

**Anti-corruption (same as products):** historical invoices do **not** call the engine again to recompute. Reprint uses stored `tax_cents` and jurisdiction breakdown.

Staff and money paths stay **owner-gated**, same as payments.

---

## Inputs we do not have yet

Tax is deferred because the **quote inputs are missing**, not because Postgres cannot store a number.

| Input | Why the engine needs it | Today |
| --- | --- | --- |
| **Ship-to address** on the order | Destination-based sales tax | Not on sales orders |
| **Origin address** | Warehouse / nexus (map from `LocationId`) | `LocationId` exists; no street/city/state |
| **Customer tax profile** | Taxable vs exempt | Credit limit only |
| **Exemption certificate** | Legal basis for $0; expiry | Not modeled |
| **SKU taxability** | Some goods, freight, or fees taxed differently | Catalog has no tax code |
| **Tax lines on invoice** | AR total and PDF | Invoice is merchandise-shaped |

Cheap prep **before** buying a vendor: persist ship-to on the order, origin on the location, exemption + certificate on the customer. Plug the engine into that. A `tax_rate` on `customers` with no address is what we are avoiding.

---

## Quote and persistence

`ITaxCalculator.quote` receives a frozen picture, not live aggregates:

- Customer id + exemption snapshot (status, certificate id if any)
- Origin (`LocationId` + address snapshot)
- Ship-to address
- Lines: sku, qty, unit price cents, taxability code
- Optional: freight cents, as its own line if we tax freight

It returns a **TaxQuote**:

- Total tax cents
- Per-line tax cents (or per jurisdiction: state / county / city)
- Engine transaction id (vendor audit id), if any
- Outcome: `exempt` (with reason) | `taxable` | `error` (do not confirm/invoice)

Persist on the **order and/or invoice** (same snapshot rule as sku/name/price):

- `merchandise_cents`
- `tax_cents`
- `total_cents` = merchandise + tax
- Jurisdiction breakdown JSON or child rows (enough to reprint the PDF)
- `tax_quoted_at`, `calculator` (vendor name + version if useful)

Payments and AR aging use **`total_cents`**, not merchandise only.

---

## Exemption (the wholesale default)

Most wholesale accounts are **resale-exempt**. The engine still runs so we have a paper trail.

Minimum customer fields:

- `tax_status`: `exempt` | `taxable` | `unknown` (unknown must not silently confirm)
- Certificate: type, number, jurisdiction, issued/expiry dates, file in object storage (`IFileStorage`)
- Staff UI: expiry warning; block or warn on confirm if expired (policy)

If the certificate is expired or missing and the customer is not taxable-with-rate, **fail the use case** — do not ship tax-free by accident.

---

## Phases

### Phase 0 — data only (can overlap v1 Sales)

- Ship-to on the order
- Origin address on `locations`
- Customer tax status + certificate upload
- Invoice/PDF already totals merchandise; leave a slot for tax (0)

No vendor. No quote. Unblocks a later adapter.

### Phase 1 — one-state / mostly exempt

- Fake or in-house adapter: exempt → $0 + reason; else one configured rate
- Snapshot on invoice
- Unit tests with in-memory `ITaxCalculator`

Enough if almost every account is resale-exempt in one nexus state.

### Phase 2 — vendor engine

- Adapter to Avalara, TaxJar, Anrok, Stripe Tax, or equivalent
- Address validation as the vendor requires
- Nexus config lives in the vendor, not in Catalog
- Still snapshot; still fake adapter in unit tests

Needed for multi-state ship-to, mixed SKU taxability, or taxable freight.

---

## What does *not* change

- Stock ledger movement types
- `available` formula
- Wholesale session `customerId` binding (clients never see other accounts’ tax)
- Two OpenAPI specs: staff may see exemption admin; wholesale only sees tax on *their* quote/invoice if the spec includes it
- No Metabase / ad-hoc tax reports — a named “tax collected in period” report later, if filings need it

---

## Returns

Tax on a return must reverse the **same snapshot**, not a new live quote.

That implies **credit memo** (and usually **RMA**) as first-class documents. Those are still open for day one. Do not implement vendor tax before we know how a return hits AR and inventory.

---

## Open decisions

1. Invoice on confirm vs ship — tax is quoted at that same moment.
2. Tax freight? As its own line?
3. Fail closed if certificate expired, or staff override with reason?
4. Phase 1 in-house vs go straight to a vendor?
5. Collect ship-to at wholesale checkout, or staff-only on the order?
6. RMA + credit memo timing vs tax go-live?

---

## Agent rules (when this is in scope)

- Domain / use cases call `ITaxCalculator` only; no vendor types on entities
- In-memory calculator in unit tests; no network in `tests/unit`
- Do not recompute tax on get/reprint
- Do not write tax from a list query or from the shop client
- Owner reviews the confirm/invoice path the same as payment application
