# Highlights: Adam Hinckley and David Smith

**Date:** 2026-08-27
**Who:** Adam Hinckley, David Smith (David Christopher's, wholesale importer)

David is in peak season: factory emails overnight, container notifications, ocean freight bills, warehouse scheduling, bank checks, plus a construction close this week. The call still got the product picture that was missing.

## What SoloView actually does for him

Not "inventory software" in the generic sense. Three jobs, one database:

1. Purchase orders from factories, with status as goods move, and inventory updating when a container hits the warehouse.
2. A wholesale vendor site where customers place orders against that same data.
3. Thin AR: 30/60/90 terms, invoices, balances for product plus shipping, payments knocking the remainder down. Auto-invoice exists on paper. The office mostly does it by hand because it does not work reliably. Fewer customers are on terms than used to be.

He stays because of the inventory math, not because the PO UI is good. SoloView POs take him "eight times as long as it should." A better PO screen he can CSV out of, even while SoloView still runs the rest, would already be useful.

## The formula everything else failed on

```
available to sell = on hand + on purchase order − already pre-sold
```

Shopify Plus could not do this. Most other vendors call the selling pattern weird.

Two modes for a SKU:

- **Open / infinite.** New item, no factory PO yet. Sell as many as anyone wants for a month or two. He does not know if it will be 100 or 100,000 pieces.
- **Locked.** After he places the factory PO, available is the formula above. Once pre-sold hits the PO quantity, stop selling even if nothing has hit the warehouse. Allocate those orders to the customers who already bought. Receive later, then ship.

He also restocks past the gap. Example: sold 1,200, 500 on hand, so 700 to fill orders, then often another 1,200 for the floor.

**Product implication Adam called out on the call:** the current database assumes you can sell against factory POs that have not arrived. It does not assume you can sell before any factory PO exists. That has to change.

## Purchase requests: skip them

Zoho-style "employee drafts a request, someone else approves spend" is not his workflow. He does not need that object.

What he does need, in a different place from the PO form: you sold 1,200 of this, nothing on hand, nothing on a PO, you need to order it. Pre-sell demand should feed factory POs, not sit in a request queue.

Office example that sounded like a request: customer wants 2,000 of two older items no longer in the current system. Rerun or not, and at what quantity.

## How demand actually arrives

Most wholesale is not the website.

- Showroom in Sheffield, orders off samples.
- David visits Carolinas, Tennessee, Georgia.
- His dad visits Arkansas, Tennessee, Alabama, Mississippi.
- Some orders on the SoloView wholesale site.
- A large slice on Faire (F-A-I-R-E). Smaller customers. ~$20/month Faire subscription can include free shipping. David cited on the order of 50,000 importers selling there.

Faire does not talk to SoloView. Path today: SoloView pushes inventory to Shopify, Shopify's Faire integration back-publishes to Faire. He never got why Faire would not connect to SoloView directly, given how many of their sellers use it. A native Faire API later should be straightforward relative to SoloView.

Retail Shopify traffic is the busy site. Wholesale traffic is small, a couple hundred visits a day would already be high, but one wholesale buyer can be $10k–$20k.

## Impersonation is a real selling tool

On the road he does not use the customer's password. He logs in as himself with elevated access, opens their account, builds a cart, submits. The order shows in their portal as if they placed it.

Atlanta gift market used to mean thousands of customers in seven days, cards keyed on that same site, stored in SoloView back office, charged at ship. That is much less now.

## How money actually moves

Immediate pay (once the shipment is assembled and they have a total):

- QuickBooks payment links are the preferred path. Better rates, customer enters their own card, fewer chargebacks than staff keying a card and charging months later.
- Shopify and SoloView can still take a card now.

Terms:

- Invoice / statement later from SoloView AR.
- Pay by ACH, statement, or check.

No payment at order for a lot of this book. They have not been paid when a SKU fails to ship, so substitutions are an inconvenience, not a refund machine.

## Drop-ship is rare and they fake the warehouse when they skip the SKU trick

Default: everything through the warehouse.

True factory-to-customer: rare. Usual dodge is a new item number, often the SKU plus `X`, customer-specific, never hits the shared book, allocated straight to them.

This year they sold a container to North Carolina without a new number and it skewed inventory. Workaround: receive in software before the goods exist, then invoice out, so the ledger looks like it went through the warehouse. Bigger firms in the same trade do a lot of that for real. First-class drop-ship can wait. The fake receive path has to stay possible.

## Brightpearl is the PO UI he actually liked

Looked at Brightpearl before Sage bought it. The demo he remembered:

- Demand rolled up by factory (they PO by factory, not as one blob).
- Per vendor: sold, shortfall vs on-hand/on-PO, MOQ, a pre-filled order tab.
- Cube: carton cubic feet or meters, running total. Target about 2,000–2,200 cubic feet in a 40-foot container or the freight is not worth it.
- Season forecast from last years' sales plus this year's pre-sold, as a starting number he can overwrite.

Adam's chat-driven PO API is explicitly version two. CSV in/out of a better PO screen is version one-adjacent.

## Manufacturer miss: "code red"

Out of 2,000–2,500 seasonal items, about four or five fail. Mold broken, paint on a rainy day, factory asks if he will accept junk (he said no on a berry stem). Customers usually substitute a similar stem.

He wants a staff action that emails everyone who ordered that item: it will not ship, here is a suggested replacement, or go find it elsewhere. SoloView did not come across as having a clean hatch for this. Worth having. Not a refund workflow.

Same pattern exists downstream: his retail customers photograph showroom samples in January, sell on Instagram before he has placed a factory order, and have no system to track that.

## Calendar

| Season | Pre-sell | Factory POs |
| --- | --- | --- |
| Next spring | June–July | All of August. Price fights for about a month. Final by end of August. (This one just ended.) |
| Christmas | December–January | Main PO push end of January. A few smaller POs in December to beat the January rush and get earlier production. |

Next useful delivery: something he can use in December/January for POs and export into SoloView. A full suite by December is unlikely while Adam has another job.

## Commercial terms discussed, not agreed

SoloView is about $2,000/month, ~$24k/year.

Adam sketched:

- **Back-loaded:** build now, then ongoing fee tied to SoloView-like value. Little cash up front.
- **Front-loaded:** ~$12k to start (hosting + build costs), ~$12k when it can replace SoloView (or unlock in chunks, e.g. when POs work), then retainer/license around $500–$1,000/month. Hosting guess: under $100/month, maybe under $50, via Neon rather than Adam running AWS/Azure for one tenant.
- **Product:** sell the same system to other importers. David knows others who pre-sell infinite until a PO locks the number. He thinks that need is growing.

David wants figures nailed before choosing. He also wants a plan Z: source code, vault of credentials, GitHub, hosting logins, so another developer can take over if Adam is gone.

Adam still needs LLC DBA, bank account, then a real contract.

## Isolation

Adam is building as if other companies will use it. Day-one signup provisions a separate database per business. No shared catalog or stock across tenants. David was fine with that.

## Open follow-ups from this call

- Change availability so infinite sell works before any factory PO exists, then lock to the formula when the PO is placed.
- PO workspace: demand-to-order list, bulk add, vendor/factory split, cube toward container fill. No purchase-request entity unless it falls out of that list.
- Staff impersonation on the wholesale site (cart-as-customer, order appears in their portal).
- AR statements and remainder math. Auto-dunning can stay weak; the ledger cannot.
- QuickBooks (and Shopify) as charge-now paths. Do not assume SoloView is the card network.
- Code-red: cancel/substitute notice to everyone holding that SKU, no refund engine required.
- Keep a receive-then-invoice path for the rare factory-direct container.
- CSV export of POs so SoloView can stay live through December/January.
- Hosting cost, retainer number, escrow/source-code access, written agreement.
