import { pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { customers } from "./customers.js";

/**
 * Identity persistence models. Three actor kinds exist without Better Auth or staff roles.
 * Sessions store an opaque id + actor_type + actor_id only.
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

export const opsUsers = identity.table("ops_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  kind: opsUserKind("kind").notNull(),
  tenantId: text("tenant_id").notNull().default("DEFAULT"),
  ...timestamps(),
});

export const staffUsers = identity.table("staff_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  ...timestamps(),
});

export const wholesaleUsers = identity.table("wholesale_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id),
  ...timestamps(),
});

/** Opaque session id. No JWT / cookie-name columns. actor_id is polymorphic. */
export const sessions = identity.table("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorType: actorType("actor_type").notNull(),
  actorId: uuid("actor_id").notNull(),
  ...timestamps(),
});
