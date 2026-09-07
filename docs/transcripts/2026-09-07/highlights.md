# Highlights: Adam Hinckley and David Smith

**Date:** 2026-09-07
**Who:** Adam Hinckley, David Smith (David Christopher's)
**Where:** In person, ~13:46 CDT. ~3 hours. Google Meet recording for the transcript.

Adam walked David through the stubbed **wholesale** and **internal** apps (same test login, super-user). David walked Adam through live SoloView: factory POs, wholesale site colors/ETAs, carts, customers, AR, order release, item snapshot, and inventory adjust.

V1 goal stated on the call: **SoloView parity first.** Extra features only if they are cheap. Do not promise December 2026 cutover.

## Action items

Owner is named. Done means the named person sent, shipped, or decided it.

### David — send / decide

| # | Action | Done when |
| --- | --- | --- |
| D1 | Email Adam a screenshot of the SoloView **customer accounting / aging** screen (open balance, apply payment to oldest, payment-plan style). | Screenshot in Adam's inbox |
| D2 | Export a spreadsheet with **image URLs** (Shopify export of links is enough; SoloView product-browser links also fine). Faire export unknown — ask Jennifer if needed. | File Adam can script against |
| D3 | Ask **Summer** how the wholesale homepage seasonal hero (pumpkins / fall) is set today. | Short answer to Adam |
| D4 | Ask **Jennifer** (or a customer who has done it) how Faire → Shopify dump works: native push vs download-then-upload. | Method written down for Adam |
| D5 | Confirm SoloView can export customers, open POs, on-hand, and **unfulfilled orders**. Tree view can stay behind. | Yes/no plus any export that fails |
| D6 | Pay Adam's **$500** invoice for August (and monthly after) once he sends a payment link. Chase business account was pending; Adam expected Tuesday/Wednesday. | Paid, invoice on file |
| D7 | Later, not today: Shopify admin / developer access so Adam can see the existing SoloView ↔ Shopify connection (REST, ~4–5 years old, Virginia checks weekly). | Adam can log into the developer side |

### Adam — product / engineering

| # | Action | Done when |
| --- | --- | --- |
| A1 | **Accounting stub.** Use D1. Customer open balance, apply a lump payment to oldest invoices, optional installment (e.g. $1,000/month). Credit limit already exists. | Screen that matches the screenshot's jobs |
| A2 | Fix **internal breadcrumb**: customer → that customer's order currently jumps to Sales and drops the customer trail. | Breadcrumb still shows the customer |
| A3 | Dark-mode cleanup (button text vs nearby labels). Consistent control heights on internal forms. | Visual pass on the pages David clicked |
| A4 | Sales-order list columns: **order number, ship date, dollar amount** (data already exists). | Columns on the list |
| A5 | PO quantity: **warn and offer round-up to case pack** before finalize. Do not silently reject for now. | Warning on a non-case qty |
| A6 | Receiving: **per-line receive** (iPad, line by line) **and** select-all / receive remaining on this container. Partial receive keeps the PO open. History already dated. | Both actions work on a multi-line PO |
| A7 | Catalog **import keeps categories** (parent + children; one SKU in many branches, up to ~10). Also persist weight / cube when they are in the CSV. | Re-import shows category filter options |
| A8 | Catalog edit: **case qty** and **discount break** (often the same number; pack-1 items use a made-up break of 3–4 for 10% off). | Fields save and show |
| A9 | **Manage pre-sale (rename it).** Filter by category (Christmas, then optional children). Date window: start / end. Bulk open infinity. Skip **discontinued** (staff-set, not SoloView's auto-discontinue-at-zero). Per-SKU toggle still required so a dropped factory stays locked. | Staff can open Christmas for a window without flipping every row |
| A10 | Wholesale catalog: **images**, category drill-down, not one 3–4k dump. | Customer can find a seasonal item on phone |
| A11 | Script **image ingest** from D2 into **our** object store (not married to Shopify/Faire/SoloView). Convert HEIC, resize for web. Naming today: `{itemCode}`, `{itemCode}-2`, `-3` for extra angles. | Products on wholesale show a picture |
| A12 | Staff **sell override** on wholesale (David logged in): add sold-out / discontinued with a loud confirm. Customers cannot. One order path for v1: wholesale site only, including phone-in orders David keys as the customer. | David can place a sold-out SKU; a customer cannot |
| A13 | Inventory **adjust** with audit (who, when). Elevated permission. Optional: large % change needs a manager PIN. Warehouse cycle count on iPad later. | Adjust writes a movement, not a silent overwrite |
| A14 | Auto **PO numbers** with factory identity (warehouse reads factory off a box). Shape like `PO-HF-00001` or first-three-digits factory + dash. | Issued PO shows a factory-readable number |
| A15 | Multi-cart on wholesale (SoloView has this; David likes it; Adam's stub does not yet). | Customer can keep more than one open cart |

### After SoloView parity (do not start as v1)

| # | Action | Notes |
| --- | --- | --- |
| L1 | **Containers on a PO:** packing-list split, container #, master B/L, vessel, per-container ETA. Receive by container. Same PO, grouped lines. China usually 100% right; India less so. | David currently splits one factory PO into several SoloView POs by hand |
| L2 | Vessel / ETA lookup (VesselFinder-class API). SoloView is manual ETA today. Fine for v1. | Cost unknown |
| L3 | Shopify GraphQL channel (existing integration is old REST). Faire native later. | See ADR 0009 |
| L4 | Resale-certificate check: trust + file image; Alabama is the audit that bites; try annual refresh; automate where the state allows, recheck quarterly/semi. | Company does not collect sales tax — this is exemption evidence |
| L5 | Seasonal homepage scheduler (ask Summer first). Nice if the rest of the site is already good. | |
| L6 | Customer download of images for SKUs they just bought (Faire-like). | Need D4 first |
| L7 | History import: attempt full dump, spot-check ~50 customers/orders vs SoloView. Tree view not required. | Riskiest ERP move; still attempt |
| L8 | Multi-store customer: many ship-tos / bill-tos vs one customer record. Today they are **separate SoloView customers**. | Decide before import |

## What we learned that was not on 2026-08-27

**PO statuses (SoloView language, still messy).** Open = draft, not issued. David issues / unissues. Pending ≈ sent, not building yet. Closed = thousands; he does not search those day to day. Live open POs are usually 15–20.

**How he builds a factory PO.** ~90% of the time he adds every item from that factory (type `DC` / `DCDE`, tab). Extra-detail on a line: on hand, sold, on PO, cost, MTD / YTD / last year / all-time. Zero what he does not want, save, issue. He can add another factory's SKU onto this PO (our item # / UPC / description stay; factory codes are wrong until they issue a new mfr # and he sends photos/samples).

**Lead time** on factory or PO = **done manufacturing**, not on the dock here. Then original ship, revised ship, actual ship, transit days (wild), ETA. ETA is what customers see on the wholesale site so they stop calling.

**Wholesale colors.** Green = in stock. Orange = out of stock, still orderable, longer wait (ETA). Red = sold out or discontinued — cannot add. Sold-out lines already in a cart **fall off at place**; no "remove these first" prompt. Stock can change while a cart sits.

**Infinity vs locked (same formula as Aug 27).** Open season = infinity until they email SoloView to flip the catalog back (no staff bulk edit). After the factory PO, per-SKU **sold out / never (infinity) / formula**. Formula: PO + on hand − sold. Pre-sold demand that is **not** already on a PO is what should build the next factory PO (Adam's Uncovered / factory rollup). Multiple POs to one factory happen (early blind fall buy in December, then Christmas fill). Direct-to-customer container (never warehouse) stays a **separate PO**.

**SKU / color.** Item codes they assign, often `DC…`. Last two letters usually color (`GN`, `OR`, …). Same numeric stem can be many SKUs. Not Shopify-style variants. Software must reject duplicate codes.

**Order release.** Unshipped orders, **ship % by dollars not units**. Calculate allocates scarce stock across the selected set, then Release prints pick lists (save file **and** send to printer) and moves orders to **pick in progress** — not an invoice yet. Picked qty is a **separate bucket** deducted from on-hand / open stock (106 on hand, 12 picking → 94 open).

**Terms.** Net 30 / 60 / 90, custom date, seasonal Nov 1 / Dec 1 for Christmas stores, 33/33/33. Newer customers: card. Old trusted: tab + credit limit. Card-on-file useful when they asked to ship and never pay the link.

**Staff override is why David still uses SoloView back-office order entry.** Wholesale site will not add discontinued/sold-out. Warehouse counts are never 100%. He needs adjust-in-stock and "sell it anyway."

**Permissions.** SoloView barely has them; warehouse paper is the real wall. He **wants** roles: cycle count on iPad, flag large variance, manager PIN.

**Cutover.** Fewest unfulfilled orders: **early–mid December**, then spring pre-orders must land in the new system before they start writing next Christmas. After Easter is the next quiet window. Run dual for months. Do not flip SoloView off day one.

**Money on this call.** $500/month covers current AI spend (discussed ~2–3 weeks earlier). Faster if they raise it (~$1k). David is fine going moderately slow — they are functioning, he is buried in a possible sale / NDAs, Jennifer is gunshy after Shopify Plus (~$2k/month, ATP formula never worked). Equity / "Adam keeps building, David sells" was talked about, **not decided**. Keys-at-cutover still on the table. Invoice from Adam's LLC once Chase is open.

**Images.** Three copies today (SoloView, Shopify, Faire — Faire often has extras + video). Own the files. Hosting cost is noise at ~4k SKUs.

## Open questions (do not invent answers)

- Exact SoloView pending vs open vs issued labels — David contradicted himself; watch a real PO.
- Ship-% confirm: dollars vs units (David "pretty sure" dollars).
- Alabama automated resale lookup: does it exist and is it worth wiring?
- Container/shipment object: v1 leftover-open PO vs L1 grouping.
- Multi-store: one customer + many addresses, or keep separate accounts for import?
- Faire image/video export path.
- Homepage CMS vs a dated asset list from Summer.
