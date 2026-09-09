import {
  bigint,
  boolean,
  char,
  date,
  foreignKey,
  integer,
  jsonb,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { customers } from "@dc-inventory/customers/schema";
import { orders } from "@dc-inventory/sales/schema";

/**
 * Accounting persistence models. Wholesale AR only — no software payments.
 */
export const accounting = pgSchema("accounting");

export const invoiceStatus = accounting.enum("invoice_status", [
  "unposted",
  "posted",
]);

export const paymentMethod = accounting.enum("payment_method", [
  "check",
  "card",
  "ach",
  "cash",
  "other",
]);

export const invoiceAdjustmentKind = accounting.enum("invoice_adjustment_kind", [
  "write_off",
  "credit_memo",
]);

export const paymentPlanFrequency = accounting.enum("payment_plan_frequency", [
  "weekly",
  "monthly",
]);

export type StoredIdempotencyApplication = {
  invoiceId: string;
  amountCents: number;
};

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
    totalCents: bigint("total_cents", { mode: "number" }).notNull(),
    currency: char("currency", { length: 3 }).notNull().default("USD"),
    billLine1: text("bill_line_1"),
    billLine2: text("bill_line_2"),
    billCity: text("bill_city"),
    billRegion: text("bill_region"),
    billPostal: text("bill_postal"),
    billCountry: text("bill_country"),
    dueDate: timestamp("due_date", { withTimezone: true, mode: "date" }),
    terms: text("terms"),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("invoices_organization_id_document_number_unique").on(
      table.organizationId,
      table.documentNumber,
    ),
    uniqueIndex("invoices_order_id_unique").on(table.orderId),
    uniqueIndex("invoices_organization_id_id_unique").on(
      table.organizationId,
      table.id,
    ),
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

export const documentNumberCounters = accounting.table("document_number_counters", {
  organizationId: text("organization_id").primaryKey(),
  lastValue: integer("last_value").notNull(),
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
    method: paymentMethod("method").notNull().default("other"),
    reference: text("reference"),
    receivedAt: timestamp("received_at", { withTimezone: true, mode: "date" }).notNull(),
    note: text("note"),
    recordedBy: uuid("recorded_by"),
    voidedAt: timestamp("voided_at", { withTimezone: true, mode: "date" }),
    voidedBy: uuid("voided_by"),
    voidReason: text("void_reason"),
    holdRemainderAsCredit: boolean("hold_remainder_as_credit").notNull().default(false),
    idempotencyApplications: jsonb("idempotency_applications")
      .$type<readonly StoredIdempotencyApplication[]>()
      .notNull()
      .default([]),
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

export const invoiceAdjustments = accounting.table(
  "invoice_adjustments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull().default("DEFAULT"),
    invoiceId: uuid("invoice_id").notNull(),
    kind: invoiceAdjustmentKind("kind").notNull(),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    currency: char("currency", { length: 3 }).notNull().default("USD"),
    reason: text("reason").notNull(),
    recordedBy: uuid("recorded_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.organizationId, table.invoiceId],
      foreignColumns: [invoices.organizationId, invoices.id],
      name: "invoice_adjustments_organization_id_invoice_id_invoices_fk",
    }),
  ],
);

export const paymentPlans = accounting.table(
  "payment_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull().default("DEFAULT"),
    customerId: uuid("customer_id").notNull(),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    currency: char("currency", { length: 3 }).notNull().default("USD"),
    frequency: paymentPlanFrequency("frequency").notNull(),
    startsOn: date("starts_on", { mode: "date" }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true, mode: "date" }),
    createdBy: uuid("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("payment_plans_organization_id_customer_id_active_unique")
      .on(table.organizationId, table.customerId)
      .where(sql`${table.endedAt} is null`),
    foreignKey({
      columns: [table.organizationId, table.customerId],
      foreignColumns: [customers.organizationId, customers.id],
      name: "payment_plans_organization_id_customer_id_customers_fk",
    }),
  ],
);
