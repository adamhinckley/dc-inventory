# Dashboard surfaces (v1)

Staff app (`apps/internal`). The shop cannot do these.

Related: [`README.md`](./README.md) (both apps + deferred) · [`customer-account.md`](./customer-account.md) · [`wholesale.md`](./wholesale.md) · [`insights.md`](./insights.md)

---

## Features

| Feature | What it is |
| --- | --- |
| Home dashboard | KPI cards from report endpoints — see [`insights.md`](./insights.md) |
| Dashboard summary report | Open orders, low-stock SKU count, AR balance, inbound PO count |
| Sales over time | Confirmed/shipped totals by day or week |
| Orders by status | Pipeline counts |
| Inventory snapshot report | On-hand / on-order / allocated / available totals or top SKUs |
| AR aging | Current / 30 / 60 / 90 |
| Tables with search, filter, sort, page | Catalog, customers, POs, orders, invoices, etc. |
| Spreadsheet export | CSV and Excel of the **current table query** (not just this page) |
| Import template download | |
| Import dry-run then commit | Row-level errors; same commands as the screens |
| Stock-count import | Creates adjustment movements; owner-gated |
| Product create / edit / deactivate | |
| Product image upload | |
| Category / tag maintenance | |
| Supplier create / edit | |
| Supplier × SKU terms | Vendor SKU, mins, costs |
| Purchase order create / confirm / receive | |
| Purchase order PDF | Generated from our data |
| Attach a supplier PDF to a PO | Stored; not parsed into lines in v1 |
| Stock adjustment | Shrink, count, damage |
| Reorder min / max | Per SKU at the default location |
| Customer create / edit | See [`customer-account.md`](./customer-account.md) — list, detail, G8 writes |
| Sales order confirm / cancel / ship | Confirm allocates stock |
| Invoice from order | On confirm **or** on ship — pick one |
| Record payment and apply to invoices | Partial pay allowed |
| Invoice PDF | |
| Attach a file to an invoice | |
| Role-gated staff actions | Admin, purchasing, warehouse, sales support (matrix TBD) |

## Product and catalog information

| Information | Source name |
| --- | --- |
| SKU | product_id |
| Name | item |
| Description | detail |
| Secondary name | item2 |
| Unit of measure | uom |
| Country of origin | c_of_o |
| Material | material |
| Body dimensions (length, width, height, diameter, size) | matching fields |
| Weight and weight unit | wt, wt_uom |
| Default weight when weight is 0 | def_wt, def_wt_uom |
| List price | lp_price |
| Member price | mp_price |
| Original wholesale price | original_wholesale_price |
| Catalog page number | catalog_pg_num |
| Default order quantity | def_qty |
| Inactive | inactive |
| Discontinued | discontin |
| Non-stock (not tracked as regular inventory) | non_stock |
| Exclude from export | no_export |
| Show on wholesale shop | webwholesale |
| Show on consumer storefront | webretail (not a v1 shop; flag only) |
| Oversold discount on/off | disc_over_sold |
| Oversold discount amount | disc_over_sold_percent |
| Line commission | line_comm (meaning unverified) |
| Carton-to-carton (meaning unknown) | c_to_c |
| UPC | upcode |
| Manufacturer / vendor item code | mfg_code |
| Alternate codes | alt_code, alt2_code, alt3_code |
| Pack dimensions and weight | pkg_* |
| Inner pack quantity, dimensions, weight | ip_* |
| Case quantity, dimensions, weight | cs_* |
| Category tags (up to ten in the dump; many-to-many in the plan) | category_1 … category_10 |
| Product images (object storage keys, not bytes in the DB) | |

## Inventory information

| Information | Source name |
| --- | --- |
| On hand | onhand_qty / loc_onhand |
| Allocated to confirmed sales not yet shipped | onpicklist_qty |
| Committed — what customers have on order with us | on_order_qty |
| Qty On PO — inbound from vendors, not yet received | rebuild from open POs (dump column unverified) |
| Available (on hand minus allocated) | derived |
| Location code | location (XJB, TA, YT, …) |
| Pick bin (dump is true/false, not a slot name) | pickbin |
| Reorder minimum | onhand_min_qty |
| Reorder maximum | onhand_max_qty |
| Count of open POs for the SKU | open_po_cnt (report, not a product column) |
| Next PO date and remaining qty | next_po, next_qty (report) |
| Vendor-side on-order (qty vs dollars unverified) | v_on_order |
| Stock movement history | ledger: inbound PO, goods received, allocated, deallocated, shipped, adjustment |

## Purchasing information

| Information | Source name |
| --- | --- |
| Supplier number | vendor_num |
| Supplier name | vendor |
| Vendor SKU | often mfg_code |
| Vendor minimum order quantity | vendor_min_order |
| Vendor minimum order amount | min_order_amt |
| Last PO cost | po_cost |
| Standard cost | standard_cost |
| Purchase order header and lines | sku/name frozen on lines |
| PO status (open / received, TBD) | |
| Receiving against a PO | |

## Customers, sales, money

| Information | Notes |
| --- | --- |
| Customer account | Wholesale buyer of this company |
| Contacts | |
| Payment terms | |
| Credit limit | Enforced at order time (gated) |
| Customer balance | Invoices minus payments |
| All customers’ orders | |
| Invoice | Merchandise totals; no sales-tax slot |
| Payments and partial applications | |
| Month-to-date / year-to-date / last year / lifetime sales | Reports, not product columns (mtd_sales, ytd_sales, last_yr_sales, all_sales) |
