# Open questions for the business

Needs answers before we lock catalog, orders, and invoicing.

Copy of the stakeholder canvas in Slack ([Open questions for the business](https://shoalssoftware.slack.com/docs/T0BQVF37DMG/F0BRPSD0LH1)). Check an item when the business has decided it. Technical follow-up stays in the architecture and schema docs.

Related: [`architecture.md`](./architecture.md) · [`database-design.md`](./database-design.md) · [`surfaces/`](./surfaces/) · [`future-concepts/multi-organization.md`](./future-concepts/multi-organization.md)

---

## Orders and invoicing

- [x] When should a **customer invoice** be created: when the sales order is **confirmed**, or when it **ships**? **Ships.** Terms still apply. Statements are not invoices.
- [ ] In the shop, is the cart a **separate cart**, or a **draft order** the customer can come back to?
- [ ] Day one: do you need **credit memos**, **RMAs / returns**, or **blanket POs**? If yes, which ones?
- [x] Can customers order only what is **on the shelf**, or should they be able to buy against **stock still on a purchase order**, and **before any factory PO exists**? **David’s formula:** available to sell = on hand + on PO − pre-sold. Per-SKU **open** (no cap until a factory PO) then **locked**. Not a company-wide season. See [ADR 0008](./adr/0008-available-to-sell-open-locked.md).
- [x] If they order more than sellable, what should happen: **block the order**, **partial fill**, or **allow oversell**? **Block the whole confirm** when the SKU is locked and the line exceeds available to sell. Open SKUs have no numeric cap. No partial confirm.

## Catalog and pricing

- [ ] Which price is the **wholesale shop price**: LP, MP, or original wholesale?
- [ ] What does **`c_to_c`** mean in the current system? Keep, drop, or rename?
- [ ] Are **`category_1` … `category_10`** merchandising **tags** (a SKU can be in several), or a real **hierarchy**?
- [ ] The dump has two product flags: whether the SKU shows on the wholesale shop (`web_wholesale`, v1) and whether it shows on a consumer storefront (`web_retail`). Keep the consumer storefront flag for a later retail site, or drop it in v1?
- [ ] **`line_comm`** (line commission) and **oversold discount**: needed in the catalog now, or a later pricing / commission conversation?
- [ ] Do product **variants** (size/color as one product) exist in how you sell, or is **SKU** the only identity that matters on day one?

## Warehouse and stock

- [ ] v1 assumes **one warehouse**. Is that true for go-live, or do you already pick from multiple locations?
- [ ] Is **`pickbin`** just yes/no, or do you need **named bin slots** on day one?
- [ ] When importing today’s dump, if **`onhand_qty`** and **`loc_onhand`** disagree: treat as an **error**, or **trust the location qty**?
- [ ] Source location codes (`XJB`, `TA`, `YT`, …): are those **bins**, **vendor areas**, or something else?

## Customers and the shop

- [ ] What **staff roles** exist (purchasing, warehouse, sales support, admin), and who may create POs, adjust stock, or issue invoices?
- [ ] Do wholesale clients see **available quantity** on the shop, or only “in stock / not”?
- [ ] Do you collect a **ship-to address** on every order today?
- [ ] Exemption certificates: keep as reseller paperwork only (not a tax engine)?

## Later — not v1, confirm we should not build it now

- [ ] Confirm the v1 **demo** targets one wholesale company (`OrganizationId.DEFAULT`). A second company on the **same deploy** is in progress — [ADR 0007](./adr/0007-organization-id-current-not-deferred.md), [Multi-organization project](https://linear.app/adamhinckley/project/multi-organization-c54d6b9bb02b) — not a separate Postgres per tenant.
- [ ] Confirm we should **not** merge the same real-world buyer across two sellers into one customer record if that ever happens.
