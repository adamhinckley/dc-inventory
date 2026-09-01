# Highlights: Adam Hinckley and David Smith

**Date:** 2026-08-31
**Who:** Adam Hinckley, David Smith (David Christopher's)

Short call. Catalog walkthrough, what the accountant actually pulls, and commercial terms left for David to think overnight.

## MP is master pack price, not member price

David does not recognize "member price." `mp_price` is **master pack price**, also **master carton price**. That is what they sell the master pack for.

There is also an **inner pack price**. The dump has `ip_qty` and inner-pack dimensions. It does not have a column named inner pack price. Do not invent one.

Adam will send the field glossary on Slack for David to mark wrong guesses. Canvas: [Product browser field glossary](https://shoalssoftware.slack.com/docs/T0BQVF37DMG/F0BTWE75N8M). Repo: [`docs/product-browser-schema-glossary.md`](../../product-browser-schema-glossary.md).

## Catalog / PO: on hand, pre-sold, need, round up to case

David wants two numbers on the list he was looking at:

- on hand
- sold / pre-sold

Shortfall is the **need**. He described it as on hand versus pre-sold, the negative being how much you must buy.

Then the PO qty should fill with the **next master pack that covers that need**, and show how many **cases** that is (`need`, rounded up to `cs_qty`, then cases = that / `cs_qty`).

He said both "closest" and "above what you need." Treat it as **round up**, not round to nearest. His 600 vs 584 example undercuts "above"; next time we show it, confirm ceil-to-case.

This is the same job as **uncovered** (`committed − on_hand − on_order`), except his spoken version skipped `on_order`. Do not drop inbound PO qty from the factory list without asking.

His "pre-sold" is **committed**, not warehouse **allocated**.

## Source of truth, then a sold / cost report

High-level product, he agreed:

1. Purchase orders from the factory
2. Receive into the warehouse
3. Ship out
4. History that lasts

The software is the source of truth for inventory **and cost**. Outflow is what shipped.

The accountant does not want a general ledger or a P&L or line-item gains and losses. She wants a period report:

- units sold / moved out of the warehouse
- dollars taken in
- what those units cost
- gain = take-in minus cost

She logs in and pulls it herself, usually **twice a month**. Daily is fine. She then types it into **QuickBooks**.

QuickBooks API sync is later polish, especially if this is sold to other companies. First login is the **accountant** role that only shows this report.

That report is a read. It does not turn Accounting into GL, AP, or inventory valuation.

## Commercial, not agreed

Adam pinned **$24,000** total (SoloView ~$2k/month × 12). Half at start, half at sign-off / delivery, then the product is David's. Bug-fix for things that should already work is included. Retainer and on-call are optional. Written scope plus a "don't run off and cut me out" agreement.

David is fine with the number in principle. He wants to think overnight for pitfalls. Time: Adam said a working internal + customer product in about two months at ~20 hours/week, maybe faster.

Deployed demo exists. Domain name is still open.
