import {
  bigint,
  char,
  foreignKey,
  integer,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { customers } from "@dc-inventory/customers/schema";
import { orders } from "@dc-inventory/sales/schema";

/**
 * Accounting persistence models. Wholesale AR only — no software payments.
 * Invoice tax lines are frozen copies; they do not live-FK to tax.
 */
export const accounting = pgSchema("accounting");

export const invoiceStatus = accounting.enum("invoice_status", [
  "unposted",
  "posted",
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

export const invoices = accounting.table(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull().default("DEFAULT"),
    orderId: uuid("order_id").notNull(),
    customerId: uuid("customer_id").notNull(),
    documentNumber: text("document_number").notNull(),
    status: invoiceStatus("status").notNull(),
    postedAt: timestamp("posted_at", { withTimezone: true, mode: "date" }),
    subtotalCents: bigint("subtotal_cents", { mode: "number" }).notNull(),
    taxTotalCents: bigint("tax_total_cents", { mode: "number" }).notNull(),
    totalCents: bigint("total_cents", { mode: "number" }).notNull(),
    currency: char("currency", { length: 3 }).notNull().default("USD"),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("invoices_organization_id_document_number_unique").on(
      table.organizationId,
      table.documentNumber,
    ),
    uniqueIndex("invoices_order_id_unique").on(table.orderId),
    foreignKey({
      columns: [table.organizationId, table.orderId],
      foreignColumns: [orders.organizationId, orders.id],
      name: "invoices_organization_id_order_id_orders_fk",
    }),
    foreignKey({
      columns: [table.organizationId, table.customerId],
      foreignColumns: [customers.organizationId, customers.id],
      name: "invoices_organization_id_customer_id_customers_fk",
    }),
  ],
);

/** Same shape as tax_commit_lines. Frozen. No live FK to tax. */
export const invoiceTaxLines = accounting.table("invoice_tax_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  invoiceId: uuid("invoice_id")
    .notNull()
    .references(() => invoices.id),
  jurisdiction: text("jurisdiction").notNull(),
  taxName: text("tax_name"),
  rateBps: integer("rate_bps").notNull(),
  taxableBaseCents: bigint("taxable_base_cents", { mode: "number" }).notNull(),
  taxCents: bigint("tax_cents", { mode: "number" }).notNull(),
  currency: char("currency", { length: 3 }).notNull().default("USD"),
  ...timestamps(),
});

export const payments = accounting.table(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull().default("DEFAULT"),
    customerId: uuid("customer_id").notNull(),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    currency: char("currency", { length: 3 }).notNull().default("USD"),
    idempotencyKey: text("idempotency_key").notNull(),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("payments_organization_id_idempotency_key_unique").on(
      table.organizationId,
      table.idempotencyKey,
    ),
    foreignKey({
      columns: [table.organizationId, table.customerId],
      foreignColumns: [customers.organizationId, customers.id],
      name: "payments_organization_id_customer_id_customers_fk",
    }),
  ],
);

export const paymentApplications = accounting.table("payment_applications", {
  id: uuid("id").primaryKey().defaultRandom(),
  paymentId: uuid("payment_id")
    .notNull()
    .references(() => payments.id),
  invoiceId: uuid("invoice_id")
    .notNull()
    .references(() => invoices.id),
  amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
  currency: char("currency", { length: 3 }).notNull().default("USD"),
  ...timestamps(),
});
