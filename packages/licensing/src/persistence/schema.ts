import {
  bigint,
  char,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const licensing = pgSchema("licensing");

export const subscriptionStatus = licensing.enum("subscription_status", [
  "trialing",
  "active",
  "past_due",
  "canceled",
]);

export const addOnGrantSource = licensing.enum("add_on_grant_source", [
  "purchased",
  "complementary",
]);

export const flagOverrideDirection = licensing.enum("flag_override_direction", [
  "force_on",
  "force_off",
]);

export const softwarePaymentStatus = licensing.enum("software_payment_status", [
  "pending",
  "succeeded",
  "failed",
  "refunded",
]);

export const softwarePaymentKind = licensing.enum("software_payment_kind", [
  "subscription",
  "add_on",
  "manual",
]);

export const softwarePaymentProvider = licensing.enum(
  "software_payment_provider",
  ["stripe", "manual"],
);

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

export const subscriptions = licensing.table("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: text("tenant_id").notNull().default("DEFAULT"),
  plan: text("plan").notNull(),
  status: subscriptionStatus("status").notNull(),
  periodStart: timestamp("period_start", { withTimezone: true, mode: "date" }).notNull(),
  periodEnd: timestamp("period_end", { withTimezone: true, mode: "date" }).notNull(),
  providerRef: text("provider_ref"),
  ...timestamps(),
});

export const addOnGrants = licensing.table("add_on_grants", {
  id: uuid("id").primaryKey().defaultRandom(),
  subscriptionId: uuid("subscription_id")
    .notNull()
    .references(() => subscriptions.id),
  addOnId: text("add_on_id").notNull(),
  source: addOnGrantSource("source").notNull(),
  ...timestamps(),
});

export const flagOverrides = licensing.table("flag_overrides", {
  id: uuid("id").primaryKey().defaultRandom(),
  subscriptionId: uuid("subscription_id")
    .notNull()
    .references(() => subscriptions.id),
  featureName: text("feature_name").notNull(),
  direction: flagOverrideDirection("direction").notNull(),
  ...timestamps(),
});

export const softwarePayments = licensing.table(
  "software_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: text("tenant_id").notNull().default("DEFAULT"),
    subscriptionId: uuid("subscription_id")
      .notNull()
      .references(() => subscriptions.id),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    currency: char("currency", { length: 3 }).notNull().default("USD"),
    status: softwarePaymentStatus("status").notNull(),
    kind: softwarePaymentKind("kind").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" }).notNull(),
    provider: softwarePaymentProvider("provider").notNull(),
    providerRef: text("provider_ref"),
    memo: text("memo"),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("software_payments_tenant_id_provider_ref_unique").on(
      table.tenantId,
      table.providerRef,
    ),
  ],
);
