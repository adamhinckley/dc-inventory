import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  pgSchema,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Inventory persistence models. Movements are the source of truth.
 * `available` is generated from on_hand - allocated and is never an input.
 * `on_order` is persisted but not part of the generated formula.
 */
export const inventory = pgSchema("inventory");

export const movementType = inventory.enum("movement_type", [
  "InboundFromPo",
  "GoodsReceived",
  "InboundCancelled",
  "Allocated",
  "Deallocated",
  "Shipped",
  "AdjustmentIncrease",
  "AdjustmentDecrease",
]);

export const movementRefType = inventory.enum("movement_ref_type", [
  "purchase_order",
  "sales_order",
  "adjustment",
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

/** `code` may be DEFAULT for v1 ATP. Named bins are not Phase 0. */
export const locations = inventory.table("locations", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  isPickBin: boolean("is_pick_bin").notNull().default(false),
  ...timestamps(),
});

export const reorderPolicies = inventory.table(
  "reorder_policies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sku: text("sku").notNull(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id),
    minOnHand: integer("min_on_hand").notNull(),
    maxOnHand: integer("max_on_hand").notNull(),
    ...timestamps(),
  },
  (table) => [unique().on(table.sku, table.locationId)],
);

export const stockMovements = inventory.table(
  "stock_movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sku: text("sku").notNull(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id),
    movementType: movementType("movement_type").notNull(),
    qty: integer("qty").notNull(),
    refType: movementRefType("ref_type").notNull(),
    refId: uuid("ref_id").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check("stock_movements_qty_positive", sql`${table.qty} > 0`),
    uniqueIndex("stock_movements_idempotency_key_sku").on(
      table.idempotencyKey,
      table.sku,
    ),
    uniqueIndex("stock_movements_once_only_provenance")
      .on(table.refType, table.refId, table.sku, table.movementType)
      .where(
        sql`${table.movementType} in ('InboundFromPo', 'InboundCancelled', 'Allocated', 'Deallocated', 'Shipped')`,
      ),
  ],
);

export const stockSnapshots = inventory.table(
  "stock_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sku: text("sku").notNull(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id),
    onHand: integer("on_hand").notNull().default(0),
    allocated: integer("allocated").notNull().default(0),
    onOrder: integer("on_order").notNull().default(0),
    available: integer("available")
      .generatedAlwaysAs(sql`on_hand - allocated`)
      .notNull(),
    ...timestamps(),
  },
  (table) => [unique().on(table.sku, table.locationId)],
);
