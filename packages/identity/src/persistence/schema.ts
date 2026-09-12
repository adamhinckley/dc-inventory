import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Persistence FK target only — not a Customers domain/application import.
 * The real customers table lives in `@dc-inventory/customers`.
 */
const customers = pgSchema("customers").table("customers", {
  id: uuid("id").primaryKey(),
});

/**
 * Identity persistence models. Opaque sessions and static staff roles, no Better Auth tables.
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
  "platform",
]);

export const staffRole = identity.enum("staff_role", [
  "admin",
  "purchasing",
  "warehouse",
  "sales_support",
  "accounting",
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
    displayName: text("display_name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash"),
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
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  ...timestamps(),
});

export const staffUsers = identity.table(
  "staff_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull().default("DEFAULT"),
    displayName: text("display_name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    roles: staffRole("roles")
      .array()
      .notNull()
      .default(sql`ARRAY['admin']::identity.staff_role[]`),
    ...timestamps(),
  },
  (table) => ({
    organizationEmailUnique: uniqueIndex("staff_users_organization_id_email_unique").on(
      table.organizationId,
      table.email,
    ),
  }),
);

export const platformUsers = identity.table(
  "platform_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    displayName: text("display_name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    ...timestamps(),
  },
  (table) => ({
    emailUnique: uniqueIndex("platform_users_email_unique").on(table.email),
  }),
);

export const wholesaleUsers = identity.table(
  "wholesale_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull().default("DEFAULT"),
    displayName: text("display_name").notNull(),
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
  staffUserId: uuid("staff_user_id").references(() => staffUsers.id),
  platformUserId: uuid("platform_user_id").references(() => platformUsers.id),
  organizationId: text("organization_id"),
  customerId: uuid("customer_id").references(() => customers.id),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  ...timestamps(),
});

export const setPasswordAudience = identity.enum("set_password_audience", [
  "staff",
  "wholesale",
  "platform",
]);

export const setPasswordTokens = identity.table(
  "set_password_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenHash: text("token_hash").notNull(),
    audience: setPasswordAudience("audience").notNull(),
    userId: uuid("user_id").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true, mode: "date" }),
    ...timestamps(),
  },
  (table) => ({
    tokenHashUnique: uniqueIndex("set_password_tokens_token_hash_unique").on(table.tokenHash),
    expiresAtIdx: index("set_password_tokens_expires_at_idx").on(table.expiresAt),
  }),
);

export const loginThrottleCounters = identity.table(
  "login_throttle_counters",
  {
    audience: actorType("audience").notNull(),
    dimension: text("dimension").notNull(),
    keyHash: text("key_hash").notNull(),
    attemptCount: integer("attempt_count").notNull(),
    windowStartedAt: timestamp("window_started_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    primaryKey({
      name: "login_throttle_counters_pk",
      columns: [table.audience, table.dimension, table.keyHash],
    }),
    index("login_throttle_counters_window_started_at_idx").on(table.windowStartedAt),
    check(
      "login_throttle_counters_dimension_check",
      sql`${table.dimension} in ('source', 'account_identifier')`,
    ),
  ],
);
