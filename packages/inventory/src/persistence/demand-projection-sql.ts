import { sql, type SQL } from "drizzle-orm";
import type { stockSnapshots } from "./schema.js";
import { sellWindowSkus, sellWindows } from "./schema.js";

/** Snapshot columns joined for catalog list sort/filter on demand projection. */
export type DemandProjectionSnapshotColumns = Readonly<{
  onHand: typeof stockSnapshots.onHand | SQL;
  onOrder: typeof stockSnapshots.onOrder | SQL;
  committed: typeof stockSnapshots.committed | SQL;
  stickyLocked: typeof stockSnapshots.stickyLocked | SQL;
  windowOpensAt: typeof stockSnapshots.windowOpensAt | SQL;
  windowClosesAt: typeof stockSnapshots.windowClosesAt | SQL;
}>;

/** Catalog identity columns for SellWindow membership EXISTS. */
export type DemandProjectionCatalogColumns = Readonly<{
  organizationId: SQL | string | { name: string };
  sku: SQL | string | { name: string };
}>;

/** SQL mirror of `isSnapshotSellWindowOpen`. */
export function isSnapshotSellWindowOpenSql(
  columns: DemandProjectionSnapshotColumns,
  nowIso: string,
): SQL<boolean> {
  return sql<boolean>`(
    (${columns.windowOpensAt} IS NULL OR ${columns.windowOpensAt} <= ${nowIso})
    AND (${columns.windowClosesAt} IS NULL OR ${columns.windowClosesAt} > ${nowIso})
  )`;
}

/**
 * SQL mirror of active SellWindow membership at `now`.
 * `nowIso` must be an ISO-8601 string (postgres.js cannot bind Date in sql fragments).
 */
export function hasActiveSellWindowMembershipSql(
  catalog: DemandProjectionCatalogColumns,
  nowIso: string,
): SQL<boolean> {
  return sql<boolean>`EXISTS (
    SELECT 1
    FROM ${sellWindowSkus} sws
    INNER JOIN ${sellWindows} sw ON sw.id = sws.sell_window_id
    WHERE sws.organization_id = ${catalog.organizationId}
      AND sws.sku = ${catalog.sku}
      AND sw.manually_closed_at IS NULL
      AND sw.window_closes_at > ${nowIso}
      AND (sw.window_opens_at IS NULL OR sw.window_opens_at <= ${nowIso})
  )`;
}

/**
 * SQL mirror of `computeEffectiveSellState` for ORDER BY / WHERE.
 * Pass `catalog` to OR snapshot window logic with active SellWindow memberships.
 * `nowIso` must be an ISO-8601 string (postgres.js cannot bind Date in sql fragments).
 */
export function isLockedForSellSql(
  columns: DemandProjectionSnapshotColumns,
  nowIso: string,
  catalog?: DemandProjectionCatalogColumns,
): SQL<boolean> {
  const stickyLocked = sql`coalesce(${columns.stickyLocked}, false)`;
  const snapshotOpen = isSnapshotSellWindowOpenSql(columns, nowIso);
  if (catalog === undefined) {
    return sql<boolean>`(
      ${stickyLocked}
      OR NOT ${snapshotOpen}
    )`;
  }
  const hasActiveMembership = hasActiveSellWindowMembershipSql(catalog, nowIso);
  return sql<boolean>`(
    ${stickyLocked}
    OR (NOT ${snapshotOpen} AND NOT ${hasActiveMembership})
  )`;
}

/**
 * SQL mirror of `projectDemandFigures` sort key for `availableToSell`.
 * Open SKUs sort as NULL; locked SKUs use on_hand + on_order - committed.
 */
export function availableToSellProjectionSql(
  columns: DemandProjectionSnapshotColumns,
  nowIso: string,
  catalog?: DemandProjectionCatalogColumns,
): SQL<number | null> {
  const onHand = sql<number>`coalesce(${columns.onHand}, 0)`;
  const onOrder = sql<number>`coalesce(${columns.onOrder}, 0)`;
  const committed = sql<number>`coalesce(${columns.committed}, 0)`;
  const locked = isLockedForSellSql(columns, nowIso, catalog);
  return sql<number | null>`CASE
    WHEN ${locked} THEN ${onHand} + ${onOrder} - ${committed}
    ELSE NULL
  END`;
}

export type StaffCatalogDemandProjectionSql = Readonly<{
  isLockedForSell: SQL<boolean>;
  availableToSell: SQL<number | null>;
  hasActiveSellWindowMembership: SQL<boolean>;
}>;

/** SQL sort/filter fragments for staff/shop catalog list demand projection. */
export function staffCatalogDemandProjectionSql(
  columns: DemandProjectionSnapshotColumns,
  nowIso: string,
  catalog?: DemandProjectionCatalogColumns,
): StaffCatalogDemandProjectionSql {
  const hasActiveMembership =
    catalog === undefined
      ? sql<boolean>`false`
      : hasActiveSellWindowMembershipSql(catalog, nowIso);
  return Object.freeze({
    isLockedForSell: isLockedForSellSql(columns, nowIso, catalog),
    availableToSell: availableToSellProjectionSql(columns, nowIso, catalog),
    hasActiveSellWindowMembership: hasActiveMembership,
  });
}

/** WHERE fragment: wholesale shop omits future scheduled windows before opens. */
export function isWholesaleHiddenBeforeOpenSql(
  columns: DemandProjectionSnapshotColumns,
  nowIso: string,
  hasActiveSellWindowMembership: SQL<boolean>,
): SQL<boolean> {
  const stickyLocked = sql`coalesce(${columns.stickyLocked}, false)`;
  return sql<boolean>`NOT (
    ${stickyLocked} = false
    AND ${columns.windowOpensAt} IS NOT NULL
    AND ${columns.windowOpensAt} > ${nowIso}
    AND NOT ${hasActiveSellWindowMembership}
  )`;
}

/** WHERE fragment: every open SKU; locked SKUs by availableToSell > 0. */
export function isShopSellableSql(
  warehouseAvailable: SQL<number>,
  columns: DemandProjectionSnapshotColumns,
  nowIso: string,
  catalog?: DemandProjectionCatalogColumns,
): SQL<boolean> {
  const projection = staffCatalogDemandProjectionSql(columns, nowIso, catalog);
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
