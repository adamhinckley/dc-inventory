import { sql } from "drizzle-orm";
import {
  bigint,
  char,
  date,
  index,
  integer,
  pgEnum,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
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

export const poStatus = pgEnum("po_status", [
  "draft",
  "confirmed",
  "received",
  "cancelled",
]);

export const suppliers = purchasing.table(
  "suppliers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull().default("DEFAULT"),
    vendorNumber: text("vendor_number").notNull(),
    name: text("name").notNull(),
    poPrefix: text("po_prefix"),
    ...timestamps(),
  },
  (table) => [
    unique().on(table.organizationId, table.vendorNumber),
    uniqueIndex("suppliers_organization_id_po_prefix_unique")
      .on(table.organizationId, table.poPrefix)
      .where(sql`${table.poPrefix} is not null`),
  ],
);

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

export const purchaseOrders = purchasing.table(
  "purchase_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull().default("DEFAULT"),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id),
    status: poStatus("status").notNull().default("draft"),
    documentNumber: text("document_number").notNull(),
    shipDate: date("ship_date", { mode: "string" }),
    cancelDate: date("cancel_date", { mode: "string" }),
    ...timestamps(),
  },
  (table) => [
    unique().on(table.organizationId, table.documentNumber),
    index("purchase_orders_organization_id_status_idx").on(
      table.organizationId,
      table.status,
    ),
  ],
);

export const supplierPoDocumentNumberCounters = purchasing.table(
  "supplier_po_document_number_counters",
  {
    organizationId: text("organization_id").notNull(),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id),
    lastValue: integer("last_value").notNull(),
  },
  (table) => [primaryKey({ columns: [table.organizationId, table.supplierId] })],
);

/** Frozen sku/name + qty. No live catalog FK. */
export const purchaseOrderLines = purchasing.table("purchase_order_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  purchaseOrderId: uuid("purchase_order_id")
    .notNull()
    .references(() => purchaseOrders.id),
  sku: text("sku").notNull(),
  name: text("name").notNull(),
  qty: integer("qty").notNull(),
  receivedQty: integer("received_qty").notNull().default(0),
  ...timestamps(),
});
