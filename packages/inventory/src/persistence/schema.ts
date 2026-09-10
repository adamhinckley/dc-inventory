import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgSchema,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { SellWindowFilterSnapshot } from "../domain/sell-window.js";

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
  "Committed",
  "Decommitted",
  "AdjustmentIncrease",
  "AdjustmentDecrease",
]);

export const movementRefType = inventory.enum("movement_ref_type", [
  "purchase_order",
  "sales_order",
  "adjustment",
]);

export const sellWindowStatus = inventory.enum("sell_window_status", [
  "scheduled",
  "open",
  "closed",
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
export const locations = inventory.table(
  "locations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull(),
    code: text("code").notNull(),
    isPickBin: boolean("is_pick_bin").notNull().default(false),
    ...timestamps(),
  },
  (table) => [unique().on(table.organizationId, table.code)],
);

export const reorderPolicies = inventory.table(
  "reorder_policies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull(),
    sku: text("sku").notNull(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id),
    minOnHand: integer("min_on_hand").notNull(),
    maxOnHand: integer("max_on_hand").notNull(),
    ...timestamps(),
  },
  (table) => [unique().on(table.organizationId, table.sku, table.locationId)],
);

export const stockMovements = inventory.table(
  "stock_movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull(),
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
    index("stock_movements_organization_id_sku_location_id_idx").on(
      table.organizationId,
      table.sku,
      table.locationId,
    ),
    uniqueIndex("stock_movements_organization_id_idempotency_key_sku").on(
      table.organizationId,
      table.idempotencyKey,
      table.sku,
    ),
    uniqueIndex("stock_movements_organization_id_once_only_provenance")
      .on(table.organizationId, table.refType, table.refId, table.sku, table.movementType)
      .where(
        sql`${table.movementType} in ('InboundFromPo', 'InboundCancelled', 'Deallocated', 'Shipped')`,
      ),
  ],
);

export const stockSnapshots = inventory.table(
  "stock_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull(),
    sku: text("sku").notNull(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id),
    onHand: integer("on_hand").notNull().default(0),
    allocated: integer("allocated").notNull().default(0),
    onOrder: integer("on_order").notNull().default(0),
    committed: integer("committed").notNull().default(0),
    stickyLocked: boolean("sticky_locked").notNull().default(false),
    windowOpensAt: timestamp("window_opens_at", { withTimezone: true, mode: "date" }),
    windowClosesAt: timestamp("window_closes_at", { withTimezone: true, mode: "date" }),
    available: integer("available")
      .generatedAlwaysAs(sql`on_hand - allocated`)
      .notNull(),
    ...timestamps(),
  },
  (table) => [unique().on(table.organizationId, table.sku, table.locationId)],
);

export const sellWindows = inventory.table("sell_windows", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: text("organization_id").notNull(),
  name: text("name").notNull(),
  filterSnapshot: jsonb("filter_snapshot").notNull().$type<SellWindowFilterSnapshot>(),
  windowOpensAt: timestamp("window_opens_at", { withTimezone: true, mode: "date" }),
  windowClosesAt: timestamp("window_closes_at", { withTimezone: true, mode: "date" }).notNull(),
  status: sellWindowStatus("status").notNull(),
  manuallyClosedAt: timestamp("manually_closed_at", { withTimezone: true, mode: "date" }),
  appliedBy: text("applied_by").notNull(),
  appliedAt: timestamp("applied_at", { withTimezone: true, mode: "date" }).notNull(),
  skuCount: integer("sku_count").notNull(),
  ...timestamps(),
});

export const sellWindowSkus = inventory.table(
  "sell_window_skus",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull(),
    sellWindowId: uuid("sell_window_id")
      .notNull()
      .references(() => sellWindows.id),
    sku: text("sku").notNull(),
    ...timestamps(),
  },
  (table) => [unique().on(table.organizationId, table.sellWindowId, table.sku)],
);
