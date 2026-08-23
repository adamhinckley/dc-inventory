import type { IQtyReadPort, ProductQty } from "@dc-inventory/catalog";
import type { Sku } from "@dc-inventory/shared-kernel";
import { and, eq, inArray } from "drizzle-orm";
import { locations, stockSnapshots } from "../infrastructure/schema/inventory.js";
import type { AppDrizzle } from "../infrastructure/db.js";

const DEFAULT_LOCATION_CODE = "DEFAULT";

/**
 * API adapter for the Catalog-owned qty read port.
 * Reads `inventory.stock_snapshots` for location code DEFAULT.
 * Missing location or snapshot is omitted (callers treat that as 0).
 * Lives in the API app so the Catalog Postgres adapter never imports inventory.
 */
export class StockSnapshotQtyReadAdapter implements IQtyReadPort {
  constructor(private readonly db: AppDrizzle) {}

  async readBySkus(skus: readonly Sku[]): Promise<ReadonlyMap<string, ProductQty>> {
    const result = new Map<string, ProductQty>();
    if (skus.length === 0) {
      return result;
    }
    const locationRows = await this.db
      .select({ id: locations.id })
      .from(locations)
      .where(eq(locations.code, DEFAULT_LOCATION_CODE))
      .limit(1);
    const locationId = locationRows[0]?.id;
    if (locationId === undefined) {
      return result;
    }
    const rows = await this.db
      .select({
        sku: stockSnapshots.sku,
        onHand: stockSnapshots.onHand,
        onOrder: stockSnapshots.onOrder,
        allocated: stockSnapshots.allocated,
        available: stockSnapshots.available,
      })
      .from(stockSnapshots)
      .where(
        and(
          eq(stockSnapshots.locationId, locationId),
          inArray(
            stockSnapshots.sku,
            skus.map((sku) => sku.value),
          ),
        ),
      );
    for (const row of rows) {
      result.set(row.sku, {
        onHand: row.onHand,
        onOrder: row.onOrder,
        allocated: row.allocated,
        available: row.available,
      });
    }
    return result;
  }
}
