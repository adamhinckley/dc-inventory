import { pgSchema, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

/**
 * Persistence FK target only — not a Customers domain/application import.
 * The real customers table lives in `@dc-inventory/customers`.
 */
const customers = pgSchema("customers").table("customers", {
  id: uuid("id").primaryKey(),
});

/**
 * Identity persistence models. Opaque sessions — no Better Auth tables, no staff role.
 * Customers is referenced only for `wholesale_users.customer_id` / session snapshot FK.
 */
export const identity = pgSchema("identity");

export const opsUserKind = identity.enum("ops_user_kind", [
  "operator",
  "business_owner",
]);

export const actorType = identity.enum("actor_type", [
  "staff",
  "wholesale",
  "ops",
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

export const opsUsers = identity.table(
  "ops_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    kind: opsUserKind("kind").notNull(),
    tenantId: text("tenant_id").notNull().default("DEFAULT"),
    ...timestamps(),
  },
  (table) => ({
    tenantEmailUnique: uniqueIndex("ops_users_tenant_id_email_unique").on(
      table.tenantId,
      table.email,
    ),
  }),
);

export const organizations = identity.table("organizations", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  ...timestamps(),
});

export const staffUsers = identity.table(
  "staff_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull().default("DEFAULT"),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    ...timestamps(),
  },
  (table) => ({
    organizationEmailUnique: uniqueIndex("staff_users_organization_id_email_unique").on(
      table.organizationId,
      table.email,
    ),
  }),
);

export const wholesaleUsers = identity.table(
  "wholesale_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull().default("DEFAULT"),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    ...timestamps(),
  },
  (table) => ({
    organizationEmailUnique: uniqueIndex("wholesale_users_organization_id_email_unique").on(
      table.organizationId,
      table.email,
    ),
  }),
);

/** Opaque session id. organization_id and customer_id are snapshotted at login. */
export const sessions = identity.table("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorType: actorType("actor_type").notNull(),
  actorId: uuid("actor_id").notNull(),
  organizationId: text("organization_id").notNull().default("DEFAULT"),
  customerId: uuid("customer_id").references(() => customers.id),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  ...timestamps(),
});
