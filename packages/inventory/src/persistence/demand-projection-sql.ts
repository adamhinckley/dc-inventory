import { sql, type SQL } from "drizzle-orm";
import type { stockSnapshots } from "./schema.js";

/** Snapshot columns joined for catalog list sort/filter on demand projection. */
export type DemandProjectionSnapshotColumns = Readonly<{
  onHand: typeof stockSnapshots.onHand | SQL;
  onOrder: typeof stockSnapshots.onOrder | SQL;
  committed: typeof stockSnapshots.committed | SQL;
  stickyLocked: typeof stockSnapshots.stickyLocked | SQL;
  windowOpensAt: typeof stockSnapshots.windowOpensAt | SQL;
  windowClosesAt: typeof stockSnapshots.windowClosesAt | SQL;
}>;

/**
 * SQL mirror of `computeEffectiveSellState` for ORDER BY / WHERE.
 * `nowIso` must be an ISO-8601 string (postgres.js cannot bind Date in sql fragments).
 */
export function isLockedForSellSql(
  columns: DemandProjectionSnapshotColumns,
  nowIso: string,
): SQL<boolean> {
  return sql<boolean>`(
    coalesce(${columns.stickyLocked}, false)
    OR (${columns.windowOpensAt} IS NOT NULL AND ${columns.windowOpensAt} > ${nowIso})
    OR (${columns.windowClosesAt} IS NOT NULL AND ${columns.windowClosesAt} <= ${nowIso})
  )`;
}

/**
 * SQL mirror of `projectDemandFigures` sort key for `availableToSell`.
 * Open SKUs sort as NULL; locked SKUs use on_hand + on_order - committed.
 */
export function availableToSellProjectionSql(
  columns: DemandProjectionSnapshotColumns,
  nowIso: string,
): SQL<number | null> {
  const onHand = sql<number>`coalesce(${columns.onHand}, 0)`;
  const onOrder = sql<number>`coalesce(${columns.onOrder}, 0)`;
  const committed = sql<number>`coalesce(${columns.committed}, 0)`;
  const locked = isLockedForSellSql(columns, nowIso);
  return sql<number | null>`CASE
    WHEN ${locked} THEN ${onHand} + ${onOrder} - ${committed}
    ELSE NULL
  END`;
}

export type StaffCatalogDemandProjectionSql = Readonly<{
  isLockedForSell: SQL<boolean>;
  availableToSell: SQL<number | null>;
}>;

/** SQL sort/filter fragments for staff/shop catalog list demand projection. */
export function staffCatalogDemandProjectionSql(
  columns: DemandProjectionSnapshotColumns,
  nowIso: string,
): StaffCatalogDemandProjectionSql {
  return Object.freeze({
    isLockedForSell: isLockedForSellSql(columns, nowIso),
    availableToSell: availableToSellProjectionSql(columns, nowIso),
  });
}

/** WHERE fragment: every open SKU; locked SKUs by availableToSell > 0. */
export function isShopSellableSql(
  warehouseAvailable: SQL<number>,
  columns: DemandProjectionSnapshotColumns,
  nowIso: string,
): SQL<boolean> {
  const projection = staffCatalogDemandProjectionSql(columns, nowIso);
  return sql<boolean>`(CASE
    WHEN ${projection.isLockedForSell} THEN ${projection.availableToSell} > 0
    ELSE true
  END)`;
}

/** ORDER BY fragment for availableToSell matching in-memory null placement. */
export function staffCatalogAvailableToSellOrderBySql(
  availableToSell: SQL<number | null>,
  sortOrder: "asc" | "desc",
): SQL {
  return sortOrder === "desc"
    ? sql`${availableToSell} DESC NULLS FIRST`
    : sql`${availableToSell} ASC NULLS LAST`;
}
