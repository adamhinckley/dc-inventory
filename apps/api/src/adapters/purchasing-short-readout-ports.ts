import type { ICommittedCustomerNamesListQuery } from "@dc-inventory/sales";
import { computeUncovered, type IInventoryReadModel } from "@dc-inventory/inventory";
import { locations, stockSnapshots } from "@dc-inventory/inventory/schema";
import type {
  ICommittedCustomerNamesPort,
  IInventoryUncoveredReadPort,
} from "@dc-inventory/purchasing";
import { LocationId, type OrganizationId, type Sku } from "@dc-inventory/shared-kernel";
import { and, eq, inArray } from "drizzle-orm";
import type { AppDrizzle } from "../infrastructure/db.js";

const DEFAULT_LOCATION_CODE = "DEFAULT";

function uniqueSkus(skus: readonly Sku[]): Sku[] {
  return [...new Map(skus.map((sku) => [sku.value, sku])).values()];
}

export function inventoryUncoveredReadPort(db: AppDrizzle): IInventoryUncoveredReadPort {
  const defaultLocationIdByOrg = new Map<string, Promise<string | null>>();

  function getDefaultLocationId(organizationId: OrganizationId): Promise<string | null> {
    const cached = defaultLocationIdByOrg.get(organizationId);
    if (cached !== undefined) {
      return cached;
    }
    const loaded = db
      .select({ id: locations.id })
      .from(locations)
      .where(
        and(
          eq(locations.code, DEFAULT_LOCATION_CODE),
          eq(locations.organizationId, organizationId),
        ),
      )
      .limit(1)
      .then((rows) => rows[0]?.id ?? null)
      .then((id) => {
        if (id === null) {
          defaultLocationIdByOrg.delete(organizationId);
        }
        return id;
      })
      .catch((error: unknown) => {
        defaultLocationIdByOrg.delete(organizationId);
        throw error;
      });
    defaultLocationIdByOrg.set(organizationId, loaded);
    return loaded;
  }

  async function getUncoveredBySkus(
    organizationId: OrganizationId,
    skus: readonly Sku[],
  ): Promise<ReadonlyMap<string, number>> {
    const values = uniqueSkus(skus);
    const result = new Map<string, number>();
    for (const sku of values) {
      result.set(sku.value, 0);
    }
    if (values.length === 0) {
      return result;
    }

    const locationId = await getDefaultLocationId(organizationId);
    if (locationId === null) {
      return result;
    }

    const rows = await db
      .select({
        sku: stockSnapshots.sku,
        onHand: stockSnapshots.onHand,
        onOrder: stockSnapshots.onOrder,
        committed: stockSnapshots.committed,
      })
      .from(stockSnapshots)
      .where(
        and(
          eq(stockSnapshots.locationId, locationId),
          eq(stockSnapshots.organizationId, organizationId),
          inArray(
            stockSnapshots.sku,
            values.map((sku) => sku.value),
          ),
        ),
      );

    for (const row of rows) {
      result.set(row.sku, computeUncovered(row.committed, row.onHand, row.onOrder));
    }
    return result;
  }

  return {
    getUncovered: async (organizationId: OrganizationId, sku: Sku) => {
      const bySku = await getUncoveredBySkus(organizationId, [sku]);
      return bySku.get(sku.value) ?? 0;
    },
    getUncoveredBySkus,
  };
}

export function inventoryUncoveredReadModelPort(
  readModel: IInventoryReadModel,
): IInventoryUncoveredReadPort {
  return {
    getUncovered: async (organizationId: OrganizationId, sku: Sku) => {
      const snapshot = await readModel.getSnapshot(sku, LocationId.DEFAULT, organizationId);
      return snapshot.uncovered;
    },
    getUncoveredBySkus: async (organizationId: OrganizationId, skus: readonly Sku[]) => {
      const result = new Map<string, number>();
      for (const sku of uniqueSkus(skus)) {
        const snapshot = await readModel.getSnapshot(sku, LocationId.DEFAULT, organizationId);
        result.set(sku.value, snapshot.uncovered);
      }
      return result;
    },
  };
}

export function committedCustomerNamesPort(
  listQuery: ICommittedCustomerNamesListQuery,
): ICommittedCustomerNamesPort {
  return {
    listCommittedCustomerNames: (organizationId, skus) =>
      listQuery.list({ organizationId, skus }),
  };
}
