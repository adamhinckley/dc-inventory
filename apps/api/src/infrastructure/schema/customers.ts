import {
  bigint,
  boolean,
  char,
  pgSchema,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Customer persistence models. Terms are free text (G6 stays open).
 * Contacts are id + customer_id + timestamps only — do not invent name/email/phone.
 */
export const customersSchema = pgSchema("customers");

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

export const customers = customersSchema.table("customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  creditLimitCents: bigint("credit_limit_cents", { mode: "number" }).notNull(),
  currency: char("currency", { length: 3 }).notNull().default("USD"),
  terms: text("terms").notNull(),
  ...timestamps(),
});

export const contacts = customersSchema.table("contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id),
  ...timestamps(),
});

export const shipTos = customersSchema.table("ship_tos", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id),
  line1: text("line_1").notNull(),
  line2: text("line_2"),
  city: text("city").notNull(),
  region: text("region").notNull(),
  postal: text("postal").notNull(),
  country: text("country").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  ...timestamps(),
});

export const exemptionCertificates = customersSchema.table(
  "exemption_certificates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    objectKey: text("object_key").notNull(),
    jurisdiction: text("jurisdiction").notNull(),
    entityUseCode: text("entity_use_code"),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }),
    status: text("status").notNull(),
    ...timestamps(),
  },
);
