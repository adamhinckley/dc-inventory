import type { IQtyReadPort, ProductQty } from "@dc-inventory/catalog";
import type { IClock } from "@dc-inventory/inventory";
import type { OrganizationId, Sku } from "@dc-inventory/shared-kernel";
import { and, eq, inArray } from "drizzle-orm";
import { locations, stockSnapshots } from "@dc-inventory/inventory/schema";
import type { AppDrizzle } from "../infrastructure/db.js";
import { productQtyFromSnapshotRow } from "./product-qty-from-snapshot.js";

const DEFAULT_LOCATION_CODE = "DEFAULT";

/**
 * API adapter for the Catalog-owned qty read port.
 * Reads `inventory.stock_snapshots` for location code DEFAULT.
 * Missing location or snapshot is omitted (callers treat that as 0).
 * Lives in the API app so the Catalog Postgres adapter never imports inventory.
 */
export class StockSnapshotQtyReadAdapter implements IQtyReadPort {
  private readonly defaultLocationIdByOrg = new Map<string, Promise<string | null>>();

  constructor(
    private readonly db: AppDrizzle,
    private readonly clock?: IClock,
  ) {}

  private getDefaultLocationId(organizationId: OrganizationId): Promise<string | null> {
    const cached = this.defaultLocationIdByOrg.get(organizationId);
    if (cached !== undefined) {
      return cached;
    }
    const loaded = this.loadDefaultLocationId(organizationId)
      .then((id) => {
        if (id === null) {
          this.defaultLocationIdByOrg.delete(organizationId);
        }
        return id;
      })
      .catch((error: unknown) => {
        this.defaultLocationIdByOrg.delete(organizationId);
        throw error;
      });
    this.defaultLocationIdByOrg.set(organizationId, loaded);
    return loaded;
  }

  private async loadDefaultLocationId(organizationId: OrganizationId): Promise<string | null> {
    const locationRows = await this.db
      .select({ id: locations.id })
      .from(locations)
      .where(
        and(
          eq(locations.code, DEFAULT_LOCATION_CODE),
          eq(locations.organizationId, organizationId),
        ),
      )
      .limit(1);
    return locationRows[0]?.id ?? null;
  }

  async readBySkus(
    organizationId: OrganizationId,
    skus: readonly Sku[],
  ): Promise<ReadonlyMap<string, ProductQty>> {
    const result = new Map<string, ProductQty>();
    if (skus.length === 0) {
      return result;
    }
    const locationId = await this.getDefaultLocationId(organizationId);
    if (locationId === null) {
      return result;
    }
    const rows = await this.db
      .select({
        sku: stockSnapshots.sku,
        onHand: stockSnapshots.onHand,
        onOrder: stockSnapshots.onOrder,
        allocated: stockSnapshots.allocated,
        committed: stockSnapshots.committed,
        stickyLocked: stockSnapshots.stickyLocked,
        windowOpensAt: stockSnapshots.windowOpensAt,
        windowClosesAt: stockSnapshots.windowClosesAt,
      })
      .from(stockSnapshots)
      .where(
        and(
          eq(stockSnapshots.locationId, locationId),
          eq(stockSnapshots.organizationId, organizationId),
          inArray(
            stockSnapshots.sku,
            skus.map((sku) => sku.value),
          ),
        ),
      );
    const now = this.clock ? this.clock.now() : new Date();
    for (const row of rows) {
      result.set(row.sku, productQtyFromSnapshotRow(row, now));
    }
    return result;
  }
}
