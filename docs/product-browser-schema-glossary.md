# Product browser field glossary

Unverified meanings for columns in the source product browser dump (`product_id` through `disc_over_sold_percent`). Do not copy this 1:1 into Postgres. Mapping work lives in [`database-design.md`](./database-design.md).

Use the Verified column when a description matches the source system.

| Field | Description | Verified |
| --- | --- | --- |
| product_id | Primary SKU or product identifier used as the unique key for inventory records. | - [ ] |
| item | Human-readable product name or title as shown in catalogs and order systems. | - [ ] |
| detail | Extended product description or supplemental detail text beyond the main item name. | - [ ] |
| item2 | Secondary description line, alternate title, or additional item labeling. | - [ ] |
| onhand_qty | Total quantity currently available in inventory (on hand). | - [ ] |
| onpicklist_qty | Quantity already allocated to open pick lists or fulfillment orders. | - [ ] |
| on_order_qty | Quantity on incoming purchase orders not yet received into stock. | - [ ] |
| onhand_min_qty | Minimum desired on-hand quantity; likely used as a reorder threshold. | - [ ] |
| onhand_max_qty | Maximum desired on-hand quantity cap for stocking levels. | - [ ] |
| standard_cost | Internal standard cost per unit used for valuation or margin calculations. | - [ ] |
| po_cost | Cost from purchase orders, likely the most recent or default PO unit cost. | - [ ] |
| v_on_order | Vendor-side on-order metric; may represent value or quantity tied to open POs. | - [ ] |
| open_po_cnt | Count of open purchase orders referencing this product. | - [ ] |
| next_po | Expected date or identifier for the next incoming purchase order. | - [ ] |
| next_qty | Quantity expected on the next incoming purchase order. | - [ ] |
| non_stock | Boolean flag indicating the item is non-stock (not tracked as regular inventory). | - [ ] |
| no_export | Boolean flag to exclude this product from external data exports. | - [ ] |
| inactive | Boolean flag marking the product inactive and likely hidden from normal use. | - [ ] |
| discontin | Boolean flag marking the product as discontinued/no longer sold. | - [ ] |
| vendor_num | Numeric identifier for the primary vendor or supplier. | - [ ] |
| vendor | Primary vendor or supplier name. | - [ ] |
| mtd_sales | Month-to-date sales total for the product (units or dollars). | - [ ] |
| ytd_sales | Year-to-date sales total for the product. | - [ ] |
| last_yr_sales | Sales total for the prior calendar or fiscal year. | - [ ] |
| all_sales | Lifetime or all-time cumulative sales total. | - [ ] |
| vendor_min_order | Minimum order quantity required by the vendor. | - [ ] |
| min_order_amt | Minimum purchase order dollar amount required by the vendor. | - [ ] |
| upcode | UPC or barcode identifier for scanning and retail integration. | - [ ] |
| lp_price | List price, likely the published wholesale list price. | - [ ] |
| mp_price | Master pack price. | - [x] |
| original_wholesale_price | Original catalog wholesale price before current pricing changes. | - [ ] |
| catalog_pg_num | Reference to a printed or digital catalog page number. | - [ ] |
| location | Warehouse or storage location code where stock is held. | - [ ] |
| loc_onhand | On-hand quantity at the specified warehouse location. | - [ ] |
| pickbin | Pick bin or slot location used during order fulfillment. | - [ ] |
| c_of_o | Country of origin code for the product. | - [ ] |
| material | Material composition or material type description. | - [ ] |
| c_to_c | Carton-to-carton or cost-to-cost flag; exact business meaning needs verification. | - [ ] |
| uom | Unit of measure for ordering and inventory (e.g., IN, YD, LB). | - [ ] |
| length | Product length dimension. | - [ ] |
| width | Product width dimension. | - [ ] |
| height | Product height dimension. | - [ ] |
| wt | Product weight. | - [ ] |
| wt_uom | Unit of measure for product weight (e.g., LB). | - [ ] |
| diameter | Product diameter dimension, used for round items. | - [ ] |
| size | General size descriptor when length/width/height are not sufficient. | - [ ] |
| pkg_len | Shipping or retail package length. | - [ ] |
| pkg_wid | Shipping or retail package width. | - [ ] |
| pkg_ht | Shipping or retail package height. | - [ ] |
| pkg_wt | Shipping or retail package weight. | - [ ] |
| pkg_wt_uom | Unit of measure for package weight. | - [ ] |
| ip_qty | Inner pack quantity (units per inner pack). | - [ ] |
| ip_len | Inner pack length dimension. | - [ ] |
| ip_wid | Inner pack width dimension. | - [ ] |
| ip_ht | Inner pack height dimension. | - [ ] |
| ip_wt | Inner pack weight. | - [ ] |
| ip_wt_uom | Unit of measure for inner pack weight. | - [ ] |
| cs_qty | Case quantity (units per master case/carton). | - [ ] |
| cs_wid | Case width dimension. | - [ ] |
| cs_len | Case length dimension. | - [ ] |
| cs_ht | Case height dimension. | - [ ] |
| cs_wt | Case weight. | - [ ] |
| category_1 | Primary product category or collection tag (hierarchical taxonomy level 1). | - [ ] |
| category_2 | Secondary category tag (taxonomy level 2). | - [ ] |
| category_3 | Tertiary category tag (taxonomy level 3). | - [ ] |
| category_4 | Category tag level 4 for merchandising or navigation. | - [ ] |
| category_5 | Category tag level 5 for merchandising or navigation. | - [ ] |
| category_6 | Category tag level 6 for merchandising or navigation. | - [ ] |
| category_7 | Category tag level 7 for merchandising or navigation. | - [ ] |
| category_8 | Category tag level 8 for merchandising or navigation. | - [ ] |
| category_9 | Category tag level 9 for merchandising or navigation. | - [ ] |
| category_10 | Category tag level 10 for merchandising or navigation. | - [ ] |
| webwholesale | Boolean flag controlling visibility on the wholesale web storefront. | - [ ] |
| webretail | Boolean flag controlling visibility on the retail web storefront. | - [ ] |
| mfg_code | Manufacturer or vendor item/manufacturer code (MFG/SKU cross-reference). | - [ ] |
| alt_code | Primary alternate product code or cross-reference SKU. | - [ ] |
| alt2_code | Second alternate product code. | - [ ] |
| alt3_code | Third alternate product code. | - [ ] |
| def_qty | Default quantity used when adding the item to orders or carts. | - [ ] |
| def_wt | Default weight value used when actual weight is not specified. | - [ ] |
| def_wt_uom | Unit of measure for the default weight. | - [ ] |
| line_comm | Line-level commission flag or amount for sales rep compensation. | - [ ] |
| disc_over_sold | Boolean flag enabling a discount rule when the item is oversold. | - [ ] |
| disc_over_sold_percent | Discount percentage applied when oversold discount is enabled. | - [ ] |
