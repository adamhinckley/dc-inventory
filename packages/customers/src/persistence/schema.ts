import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  char,
  integer,
  pgSchema,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Customer persistence models. Terms are free text (G6 stays open).
 * Contacts lift name / email / phone (phone optional). Email is unique per Customer.
 * Exemption object_key is nullable so metadata-only rows are valid. No upload.
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

export const customers = customersSchema.table(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull().default("DEFAULT"),
    name: text("name").notNull(),
    customerNumber: text("customer_number").notNull(),
    creditLimitCents: bigint("credit_limit_cents", { mode: "number" }).notNull(),
    currency: char("currency", { length: 3 }).notNull().default("USD"),
    terms: text("terms").notNull(),
    taxId: text("tax_id"),
    accountStatus: text("account_status").notNull().default("active"),
    customerNote: text("customer_note"),
    staffNote: text("staff_note"),
    ...timestamps(),
  },
  (table) => [
    unique("customers_organization_id_id_unique").on(
      table.organizationId,
      table.id,
    ),
    unique("customers_organization_id_customer_number_unique").on(
      table.organizationId,
      table.customerNumber,
    ),
  ],
);

export const contacts = customersSchema.table(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    ...timestamps(),
  },
  (table) => [unique().on(table.customerId, table.email)],
);

export const shipTos = customersSchema.table(
  "ship_tos",
  {
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
  },
  (table) => [
    uniqueIndex("ship_tos_customer_id_default_unique")
      .on(table.customerId)
      .where(sql`${table.isDefault} = true`),
  ],
);

export const billTos = customersSchema.table("bill_tos", {
  customerId: uuid("customer_id")
    .primaryKey()
    .references(() => customers.id),
  line1: text("line_1").notNull(),
  line2: text("line_2"),
  city: text("city").notNull(),
  region: text("region").notNull(),
  postal: text("postal").notNull(),
  country: text("country").notNull(),
  ...timestamps(),
});

export const exemptionCertificates = customersSchema.table(
  "exemption_certificates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    objectKey: text("object_key"),
    jurisdiction: text("jurisdiction").notNull(),
    entityUseCode: text("entity_use_code"),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }),
    status: text("status").notNull(),
    ...timestamps(),
  },
);

export const documentNumberCounters = customersSchema.table(
  "document_number_counters",
  {
    organizationId: text("organization_id").primaryKey(),
    lastValue: integer("last_value").notNull(),
  },
);
