# Tax (v1: none)

This company sells **wholesale to resellers only**. It does not sell to taxable end-users. **v1 does not quote, commit, or store sales tax.**

Related: [`architecture.md`](./architecture.md) · [`database-design.md`](./database-design.md) · [`invariants.md`](./invariants.md) (C15, TX1–TX3) · [`customers.md`](./customers.md) (reseller Tax ID and exemption files are customer master, not a tax engine) · [`wholesale-resale-license-onboarding.md`](./wholesale-resale-license-onboarding.md) (resale / “wholesale license” research; does not change v1).

There is no Tax bounded context in the product law. There is no `ITaxCalculator`. Checkout and invoices are merchandise amounts only.

---

## What v1 does not have

- `tax` schema tables (`tax_commits`, `tax_commit_lines`)
- `accounting.invoice_tax_lines`
- `tax_total` / tax lines on invoices
- `tax_category_code` on products or order lines
- Hosted engines (AvaTax, Stripe Tax) or a homegrown rate table
- Quote at cart, commit at invoice post, fail-closed engine HTTP

Do not add any of those. Do not multiply `price * rate` in Sales, Accounting, Catalog, or a UI.

The scaffold may still contain empty tax tables and `packages/tax` from an earlier plan. **Do not extend them.** Drop them in a dedicated packet; do not grow quote/commit in place.

---

## What stays (not sales tax)

| Thing | Why it is not a tax engine |
|---|---|
| Customer **Tax ID** | Optional reseller identifier on the account (`docs/customers.md`) |
| **Exemption certificates** | Resale paperwork on the customer. Evidence only — not a confirm/ship gate, not tax math (U12–U13) |

---

## Invoices

Invoice money is merchandise: line snapshots and the invoice total. Payments apply to that total. There is no committed tax amount to freeze.

---

## Older notes

[`tax-engine.md`](./tax-engine.md) described a quote/commit port. That path is **not** v1. Ignore it unless the owner re-opens sales tax as a plan change.
