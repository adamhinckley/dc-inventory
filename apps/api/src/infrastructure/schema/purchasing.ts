import {
  bigint,
  char,
  integer,
  pgSchema,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

/** Purchasing persistence models. Vendor terms live here, not on catalog.products. */
export const purchasing = pgSchema("purchasing");

function timestamps() {
  return {
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  };
}

export const suppliers = purchasing.table("suppliers", {
  id: uuid("id").primaryKey().defaultRandom(),
  vendorNumber: text("vendor_number").notNull().unique(),
  name: text("name").notNull(),
  ...timestamps(),
});

export const supplierProducts = purchasing.table(
  "supplier_products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id),
    sku: text("sku").notNull(),
    supplierSku: text("supplier_sku"),
    minOrderQty: integer("min_order_qty"),
    minOrderAmountCents: bigint("min_order_amount_cents", { mode: "number" }),
    lastPoCostCents: bigint("last_po_cost_cents", { mode: "number" }),
    currency: char("currency", { length: 3 }).notNull().default("USD"),
    ...timestamps(),
  },
  (table) => [unique().on(table.supplierId, table.sku)],
);

/** Thin PO header — no document number, no G9 status machine. */
export const purchaseOrders = purchasing.table("purchase_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  supplierId: uuid("supplier_id")
    .notNull()
    .references(() => suppliers.id),
  ...timestamps(),
});

/** Frozen sku/name + qty. No live catalog FK. */
export const purchaseOrderLines = purchasing.table("purchase_order_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  purchaseOrderId: uuid("purchase_order_id")
    .notNull()
    .references(() => purchaseOrders.id),
  sku: text("sku").notNull(),
  name: text("name").notNull(),
  qty: integer("qty").notNull(),
  ...timestamps(),
});
