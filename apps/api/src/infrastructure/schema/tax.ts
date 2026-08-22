import {
  bigint,
  char,
  integer,
  pgSchema,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { invoices } from "./accounting.js";
import { orders } from "./sales.js";

/**
 * Tax persistence models. Quote / commit / void only.
 * `rate_bps` is display/audit — never multiply later. No product tax percent.
 */
export const tax = pgSchema("tax");

export const taxCommitStatus = tax.enum("tax_commit_status", [
  "quoted",
  "committed",
  "voided",
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

export const taxCommits = tax.table("tax_commits", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").references(() => orders.id),
  invoiceId: uuid("invoice_id").references(() => invoices.id),
  engineTransactionId: text("engine_transaction_id"),
  status: taxCommitStatus("status").notNull(),
  ...timestamps(),
});

export const taxCommitLines = tax.table("tax_commit_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  taxCommitId: uuid("tax_commit_id")
    .notNull()
    .references(() => taxCommits.id),
  jurisdiction: text("jurisdiction").notNull(),
  taxName: text("tax_name"),
  rateBps: integer("rate_bps").notNull(),
  taxableBaseCents: bigint("taxable_base_cents", { mode: "number" }).notNull(),
  taxCents: bigint("tax_cents", { mode: "number" }).notNull(),
  currency: char("currency", { length: 3 }).notNull().default("USD"),
  ...timestamps(),
});
