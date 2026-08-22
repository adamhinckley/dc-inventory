# Insights and metrics (dashboard)

Owner metrics for the wholesale business. **Dashboard only.** The shop does not get these.

Each insight is a **report** (KPI card or chart from Postgres), not a spreadsheet the browser totals. v1 already names a small set; the rest can be added later as more report endpoints if the ledger, orders, POs, and invoices exist.

Related: [`README.md`](./README.md) · [`dashboard.md`](./dashboard.md) · [`wholesale.md`](./wholesale.md)

Wholesale clients might see **their** order counts, their invoices, and whether an item is available. They do not see company-wide KPIs, other buyers, costs, or AR aging.

---

## Already named in v1

| Insight | What the owner sees |
| --- | --- |
| Open sales orders | How much work is in the pipeline |
| Low-stock SKU count | SKUs at or below reorder minimum |
| AR balance | What customers still owe |
| Inbound PO count | How many purchase orders are still open |
| Sales over time | Confirmed or shipped dollars by day or week |
| Orders by status | Draft / confirmed / shipped / cancelled mix |
| Inventory snapshot | On-hand, on-order, allocated, available — totals or top SKUs |
| AR aging | Current / 30 / 60 / 90 |
| Product sales MTD, YTD, last year, lifetime | Same idea as today’s dump, as reports not product columns |

## Inventory health (from the stock ledger + reorder mins/maxes)

| Insight | Why it matters |
| --- | --- |
| Available vs allocated vs on order | Can we ship what is already sold, and what is still coming in? |
| SKUs below minimum | Reorder list |
| SKUs above maximum | Cash tied up in overstock |
| Zero available but allocated | We sold it; the floor cannot fill it without a receipt or a cancel |
| On-hand with no sales in N days | Dead / slow stock (from shipped movements) |
| Days of supply | On hand divided by recent ship rate |
| Inventory turns | How fast stock leaves relative to what we hold |
| Adjustment / shrink quantity and dollars | Count, damage, loss (needs cost to put $ on it) |
| Inactive or discontinued SKUs that still have on-hand | Markdown or return-to-vendor candidates |
| Coverage of open orders | Allocated compared with on-hand plus inbound (inbound is **shown**, not sellable, in v1) |
| Next inbound date and qty per SKU | When the hole might close |

## Sales and service

| Insight | Why it matters |
| --- | --- |
| Sales $ and units (day / week / month / YTD vs last year) | Is the book growing? |
| Top SKUs by dollars and by units | What to stock and what to feature |
| Top customers by dollars | Concentration risk |
| Average order value and lines per order | Mix and ticket size |
| Cancel rate after confirm | Lost allocation / unhappy buyers |
| Time from confirm to ship | Warehouse speed |
| Orders waiting to ship (allocated, not shipped) | Pick-list backlog |
| Lines the shop could not fully allocate | Demand we turned away (needs recording failed allocates) |
| Fill rate | Confirmed qty vs requested qty |

## Purchasing and suppliers

| Insight | Why it matters |
| --- | --- |
| Open PO dollars and units | Commitments to vendors |
| Receipts vs ordered (shorts) | Vendor reliability |
| Time from PO confirm to receive | Lead time |
| Spend by supplier | Who we depend on |
| Last PO cost vs selling price | Rough margin per SKU (not a full inventory valuation) |
| SKUs under min with no open PO | Reorder gap |

## Customers and cash

| Insight | Why it matters |
| --- | --- |
| Customers over or near credit limit | Who to hold |
| Past-due invoices and dollars | Who to collect |
| Days sales outstanding | How fast invoices turn to cash |
| Payments received over time | Cash in |
| Balance by customer | Who owes the most |
| Customers with no orders in N days | At-risk accounts |

## Margin (thin, no general ledger)

| Insight | Caveat |
| --- | --- |
| Selling price minus last PO cost or standard cost | Gross margin estimate on shipped lines |
| Margin by SKU, customer, or period | Still not inventory asset value or a P&L |
| Commission dollars | Only if line commission is a real amount, not just a flag |

## Deeper metrics (same planned data, not listed above)

Most of these are extra **report endpoints** on the ledger, orders, POs, invoices, and catalog flags. They do not need a warehouse-management or BI product. Mark **$** where you multiply qty by last PO cost or standard cost — that is a **costed estimate**, not general-ledger inventory valuation.

### Mix, concentration, and working capital

| Insight | Why it matters | Notes |
| --- | --- | --- |
| ABC (Pareto) of SKUs by shipped $ | 20% of SKUs often drive most of the book | Rank and cumulative % |
| ABC of customers by shipped $ | Same for buyer concentration | “If the top 5 leave, we lose X%” |
| Share of sales in top 10 SKUs / customers | Concentration risk on one card | |
| Inventory $ at last PO cost or standard cost | Cash sitting on the floor | Not a balance-sheet number |
| Excess inventory $ | Qty above reorder max × cost | Cash you could stop replenishing |
| Shortage exposure $ | Qty below min × cost, or allocated with no available | Risk of lost sales |
| Inventory days / days inventory outstanding | Average on-hand $ / daily COGS or daily shipped $ | Pair with DSO; cash-conversion cycle needs AP (not v1) |
| GMROI | Gross-margin $ / average inventory $ | “Does this SKU earn its space?” |
| On-hand $ in A vs B vs C items | Slow cash trapped in C | |
| On-hand $ in inactive / discontinued / non-stock | Should not be there | |

### Demand shape and catalog hygiene

| Insight | Why it matters | Notes |
| --- | --- | --- |
| Never sold (no shipped movement) but on-hand > 0 | Bought it, nobody wanted it | |
| Sold once, never again | One-off vs a line you should keep | |
| Visible on the wholesale shop with no orders in N days | Dead merchandising | Uses show-on-wholesale-shop flag |
| High on-hand, low turns, still above min | Min/max policy is wrong | |
| Demand variability (ship qty stdev / mean) | Jumpy SKUs need more buffer | Needs enough history |
| This week vs same week last year | Seasonality | Needs > 1 year of orders |
| Category / collection mix of sales and of inventory $ | Over-buy in a tag | |
| SKUs missing image, cost, or selling price | Cannot run the shop or margin reports cleanly | Data-quality dashboard |
| SKUs with standard cost 0 | Margin reports will lie | Common in the current dump |
| Duplicate or colliding UPC / alt codes | Receiving and shop search pain | Identifiers table |

### Fulfillment quality (finer than “fill rate”)

| Insight | Why it matters | Notes |
| --- | --- | --- |
| Unit fill, line fill, order fill | A shorted line can still “count” as an order | Three different percentages |
| Complete-and-on-time orders | Perfect-order proxy | Needs a promised or requested ship date if you store one |
| Same-day or next-day ship % | Speed promise | Confirm timestamp → ship timestamp |
| Age of unshipped allocated lines | Stale picks | Hours/days in “allocated” |
| Short-ship vs cancel vs full ship | How you fail | |
| Staff-placed vs shop-placed orders | Who is actually using the site | Actor type on the order |
| Weight or cube of open picks | Labor / carrier planning | From pack / case dimensions × allocated qty |

### Purchasing depth

| Insight | Why it matters | Notes |
| --- | --- | --- |
| Supplier OTIF | On time and in full vs the PO | Needs expected date on the PO |
| Lead time p50 / p95 by supplier and SKU | Planning, not a single average | Confirm → first receipt |
| PO cost vs previous PO cost | Vendor raised price | Line snapshots |
| PO cost vs standard cost | Variance | |
| Single-sourced SKUs | One vendor dies, that line dies | Count of suppliers per SKU |
| Open PO $ by supplier | Concentration of commitments | |
| Ordered extra only to hit vendor minimum | Hidden cost of mins | Compare line qty to min order qty |
| SKUs below min, no open PO, and shop-visible | Customer will see a hole | |
| Time from “need to reorder” (crossed min) to PO confirm | Purchasing lag | Needs detecting the min-cross from snapshots or movements |

### Customers, credit, and cash depth

| Insight | Why it matters | Notes |
| --- | --- | --- |
| Credit utilization (balance / limit) | Who is about to freeze | |
| Failed or blocked confirms for credit | Demand we refused | Needs recording credit-check failures |
| New vs returning buyers (first order date) | Acquisition vs retention | |
| Repeat rate / orders per customer per period | Stickiness | |
| Last-order recency buckets | Churn watch | 30 / 60 / 90 / 180 |
| Lifetime sales vs current AR | Big customer who is also late | |
| Terms mix | Net 30 vs tighter terms | If terms are stored as data, not a blob |
| Partial-pay leftover aging | Invoices that never finish | Payment applications |
| Share of AR in top N customers | Collection risk | |
| Staff vs shop mix of a customer’s orders | Are they self-serve? | |

### Price and margin depth

| Insight | Why it matters | Notes |
| --- | --- | --- |
| Price realization (sold $ / list $) | Discounting leakage | Frozen line price vs current or then-list |
| Margin $ and % by SKU, category, customer, supplier | Where profit actually is | Costed at last PO or standard; pick one and label it |
| Negative-margin shipped lines | Selling below cost | |
| Oversold-discount usage | If that flag is real policy | |
| Margin on A items vs C items | Are you profitable on the long tail? | |
| Commission $ by period | Only if commission is an amount | |

## Cheap extra capture (small events, large insight)

These are not new products. They are facts to persist when a use case already runs, so reports are honest.

| Capture | Unlocks |
| --- | --- |
| Allocation rejected (SKU, qty requested, qty available, customer, time) | True lost demand, fill rate, “would have bought” |
| Credit check rejected | Credit as a sales throttle, not only a balance |
| Expected / promised dates on POs and sales orders | OTIF, late inbound, late ship |
| Actor on every order (staff vs wholesale user) | Shop adoption |
| Cart abandoned (draft order or cart row left past N hours) | Shop funnel without a full analytics suite |
| Catalog search with zero results (`q` that missed) | Missing assortment or bad aliases |

Shop **browse → cart → checkout** conversion, PDP views, and heatmaps need product-analytics events (or a later tool). Do not fake them from Postgres if you never stored the view.

## Still out of reach until other modules

| Insight | Why we cannot honestly show it yet |
| --- | --- |
| Full cash-conversion cycle | No AP / vendor bills in v1 (no days payable) |
| True inventory asset / P&L / EBITDA | No general ledger, no inventory valuation policy |
| Lot/serial aging, expiry, FIFO layers | Ledger is qty + type, not lots |
| Pick accuracy, lines per labor hour | No picker identity or mispick event |
| Tax collected vs exempt share | Tax engine later |
| Return rate, refunds, credit-memo leakage | RMA / credit memo not v1 unless the business requires them |
| Multi-location ATP and transfer lag | One warehouse in v1 |
| Forecast vs actual, safety-stock optimization | No demand-planning model (min/max is the policy) |
