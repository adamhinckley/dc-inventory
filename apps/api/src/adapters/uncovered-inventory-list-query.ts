import {
  computeUncovered,
  type IUncoveredListQuery,
  type UncoveredListQuery,
} from "@dc-inventory/inventory";
import { locations, stockSnapshots } from "@dc-inventory/inventory/schema";
import { LocationId, OrganizationId, Sku } from "@dc-inventory/shared-kernel";
import { and, asc, count, eq, gt, sql } from "drizzle-orm";
import type { AppDrizzle } from "../infrastructure/db.js";

const DEFAULT_LOCATION_CODE = "DEFAULT";

/**
 * Paged uncovered SKU read from movement-derived stock snapshots.
 * Formula only — catalog/reorder joins happen in `ListUncoveredSkusUseCase`.
 */
export class UncoveredInventoryListQuery implements IUncoveredListQuery {
  constructor(private readonly db: AppDrizzle) {}

  async list(query: UncoveredListQuery) {
    const organizationId = OrganizationId.parse(query.organizationId);
    const locationId = query.locationId ?? LocationId.DEFAULT;
    const locationRows = await this.db
      .select({ id: locations.id })
      .from(locations)
      .where(
        and(
          eq(locations.organizationId, organizationId),
          eq(locations.code, locationId === LocationId.DEFAULT ? DEFAULT_LOCATION_CODE : locationId),
        ),
      )
      .limit(1);
    const locationUuid = locationRows[0]?.id;
    if (locationUuid === undefined) {
      return { items: [], total: 0 };
    }

    const onHand = sql<number>`coalesce(${stockSnapshots.onHand}, 0)`;
    const onOrder = sql<number>`coalesce(${stockSnapshots.onOrder}, 0)`;
    const committed = sql<number>`coalesce(${stockSnapshots.committed}, 0)`;
    const uncovered = sql<number>`greatest(0, ${committed} - ${onHand} - ${onOrder})`;
    const where = and(
      eq(stockSnapshots.organizationId, organizationId),
      eq(stockSnapshots.locationId, locationUuid),
      gt(uncovered, 0),
    );
    const offset = (query.page - 1) * query.pageSize;

    const [totalRow] = await this.db
      .select({ total: count() })
      .from(stockSnapshots)
      .where(where);
    const rows = await this.db
      .select({
        sku: stockSnapshots.sku,
        onHand: stockSnapshots.onHand,
        onOrder: stockSnapshots.onOrder,
        committed: stockSnapshots.committed,
      })
      .from(stockSnapshots)
      .where(where)
      .orderBy(asc(stockSnapshots.sku))
      .limit(query.pageSize)
      .offset(offset);

    return {
      total: Number(totalRow?.total ?? 0),
      items: rows.map((row) =>
        Object.freeze({
          sku: Sku.parse(row.sku),
          committed: row.committed,
          onHand: row.onHand,
          onOrder: row.onOrder,
          uncovered: computeUncovered(row.committed, row.onHand, row.onOrder),
        }),
      ),
    };
  }

  async listAll(query: Omit<UncoveredListQuery, "page" | "pageSize">) {
    const organizationId = OrganizationId.parse(query.organizationId);
    const locationId = query.locationId ?? LocationId.DEFAULT;
    const locationRows = await this.db
      .select({ id: locations.id })
      .from(locations)
      .where(
        and(
          eq(locations.organizationId, organizationId),
          eq(locations.code, locationId === LocationId.DEFAULT ? DEFAULT_LOCATION_CODE : locationId),
        ),
      )
      .limit(1);
    const locationUuid = locationRows[0]?.id;
    if (locationUuid === undefined) {
      return [];
    }

    const onHand = sql<number>`coalesce(${stockSnapshots.onHand}, 0)`;
    const onOrder = sql<number>`coalesce(${stockSnapshots.onOrder}, 0)`;
    const committed = sql<number>`coalesce(${stockSnapshots.committed}, 0)`;
    const uncovered = sql<number>`greatest(0, ${committed} - ${onHand} - ${onOrder})`;
    const where = and(
      eq(stockSnapshots.organizationId, organizationId),
      eq(stockSnapshots.locationId, locationUuid),
      gt(uncovered, 0),
    );

    const rows = await this.db
      .select({
        sku: stockSnapshots.sku,
        onHand: stockSnapshots.onHand,
        onOrder: stockSnapshots.onOrder,
        committed: stockSnapshots.committed,
      })
      .from(stockSnapshots)
      .where(where)
      .orderBy(asc(stockSnapshots.sku));

    return rows.map((row) =>
      Object.freeze({
        sku: Sku.parse(row.sku),
        committed: row.committed,
        onHand: row.onHand,
        onOrder: row.onOrder,
        uncovered: computeUncovered(row.committed, row.onHand, row.onOrder),
      }),
    );
  }
}
