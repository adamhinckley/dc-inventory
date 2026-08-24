import {
  bigint,
  char,
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
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    documentNumber: text("document_number").notNull().unique(),
    status: invoiceStatus("status").notNull(),
    postedAt: timestamp("posted_at", { withTimezone: true, mode: "date" }),
    subtotalCents: bigint("subtotal_cents", { mode: "number" }).notNull(),
    taxTotalCents: bigint("tax_total_cents", { mode: "number" }).notNull(),
    totalCents: bigint("total_cents", { mode: "number" }).notNull(),
    currency: char("currency", { length: 3 }).notNull().default("USD"),
    ...timestamps(),
  },
  (table) => [uniqueIndex("invoices_order_id_unique").on(table.orderId)],
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
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    currency: char("currency", { length: 3 }).notNull().default("USD"),
    idempotencyKey: text("idempotency_key").notNull(),
    ...timestamps(),
  },
  (table) => [uniqueIndex("payments_idempotency_key_unique").on(table.idempotencyKey)],
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
