import {
  bigint,
  char,
  foreignKey,
  integer,
  pgSchema,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { customers } from "@dc-inventory/customers/schema";

/**
 * Sales persistence models. Cart is a draft order — no carts table.
 * Ship-to is a typed snapshot (no live ship_to_id). Lines freeze MP.
 */
export const sales = pgSchema("sales");

export const orderStatus = sales.enum("order_status", [
  "draft",
  "confirmed",
  "shipped",
  "cancelled",
]);

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

export const orders = sales.table(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull().default("DEFAULT"),
    customerId: uuid("customer_id").notNull(),
    status: orderStatus("status").notNull().default("draft"),
    documentNumber: text("document_number").notNull(),
    shipLine1: text("ship_line_1"),
    shipLine2: text("ship_line_2"),
    shipCity: text("ship_city"),
    shipRegion: text("ship_region"),
    shipPostal: text("ship_postal"),
    shipCountry: text("ship_country"),
    ...timestamps(),
  },
  (table) => [
    unique("orders_organization_id_id_unique").on(table.organizationId, table.id),
    uniqueIndex("orders_organization_id_document_number_unique").on(
      table.organizationId,
      table.documentNumber,
    ),
    foreignKey({
      columns: [table.organizationId, table.customerId],
      foreignColumns: [customers.organizationId, customers.id],
      name: "orders_organization_id_customer_id_customers_fk",
    }),
  ],
);

/** Frozen sku/name + MP unit price. No live catalog FK. */
export const orderLines = sales.table("order_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id),
  sku: text("sku").notNull(),
  name: text("name").notNull(),
  qty: integer("qty").notNull(),
  unitPriceCents: bigint("unit_price_cents", { mode: "number" }).notNull(),
  currency: char("currency", { length: 3 }).notNull().default("USD"),
  taxCategoryCode: text("tax_category_code"),
  ...timestamps(),
});
