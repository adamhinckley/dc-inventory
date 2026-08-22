# Open questions for the business

Needs answers before we lock catalog, orders, and invoicing.

Copy of the stakeholder canvas in Slack ([Open questions for the business](https://shoalssoftware.slack.com/docs/T0BQVF37DMG/F0BRPSD0LH1)). Check an item when the business has decided it. Technical follow-up stays in the architecture and schema docs.

Related: [`architecture.md`](./architecture.md) · [`database-design.md`](./database-design.md) · [`surfaces/`](./surfaces/) · [`future-concepts/multi-organization.md`](./future-concepts/multi-organization.md)

---

## Orders and invoicing

- [ ] When should a **customer invoice** be created: when the sales order is **confirmed**, or when it **ships**?
- [ ] In the shop, is the cart a **separate cart**, or a **draft order** the customer can come back to?
- [ ] Day one: do you need **credit memos**, **RMAs / returns**, or **blanket POs**? If yes, which ones?
- [ ] Can customers order only what is **on the shelf** (`available` = on hand minus already allocated), or should they be able to buy against **stock still on a purchase order**?
- [ ] If they order more than `available`, what should happen: **block the order**, **partial fill**, or **allow oversell**?

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
- [ ] Do you collect a **ship-to address** on every order today (needed for tax quote)?
- [ ] Are most accounts **resale-exempt** (certificate on file), **taxable**, or mixed? (v1 quotes/commits tax via [`tax.md`](./tax.md); this sets engine and exemption expectations.)

## Later — not v1, confirm we should not build it now

- [ ] Confirm v1 is **this one wholesale company only**. A second company signing up on the same website is a later feature.
- [ ] Confirm we should **not** merge the same real-world buyer across two sellers into one customer record if that ever happens.
