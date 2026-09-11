import type { ICommittedCustomerNamesListQuery } from "@dc-inventory/sales";
import {
  computeToOrder,
  InMemoryInventoryReadModel,
  type IInventoryReadModel,
} from "@dc-inventory/inventory";
import { locations, stockSnapshots } from "@dc-inventory/inventory/schema";
import type {
  ICommittedCustomerNamesPort,
  IInventoryToOrderReadPort,
} from "@dc-inventory/purchasing";
import { LocationId, type OrganizationId, type Sku } from "@dc-inventory/shared-kernel";
import { and, eq, inArray } from "drizzle-orm";
import type { AppDrizzle } from "../infrastructure/db.js";

const DEFAULT_LOCATION_CODE = "DEFAULT";

function uniqueSkus(skus: readonly Sku[]): Sku[] {
  return [...new Map(skus.map((sku) => [sku.value, sku])).values()];
}

export function inventoryToOrderReadPort(db: AppDrizzle): IInventoryToOrderReadPort {
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

  async function getToOrderBySkus(
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

    // Missing DEFAULT location: treat every SKU as toOrder 0 (same as default snapshot /
    // StockSnapshotQtyReadAdapter omitting rows). PreOrderInventoryListQuery returns [].
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
      result.set(row.sku, computeToOrder(row.committed, row.onHand, row.onOrder));
    }
    return result;
  }

  return {
    getToOrder: async (organizationId: OrganizationId, sku: Sku) => {
      const bySku = await getToOrderBySkus(organizationId, [sku]);
      return bySku.get(sku.value) ?? 0;
    },
    getToOrderBySkus,
  };
}

export function inventoryToOrderReadModelPort(
  readModel: IInventoryReadModel,
): IInventoryToOrderReadPort {
  return {
    getToOrder: async (organizationId: OrganizationId, sku: Sku) => {
      const snapshot = await readModel.getSnapshot(sku, LocationId.DEFAULT, organizationId);
      return snapshot.toOrder;
    },
    getToOrderBySkus: async (organizationId: OrganizationId, skus: readonly Sku[]) => {
      const values = uniqueSkus(skus);
      const result = new Map<string, number>();
      for (const sku of values) {
        result.set(sku.value, 0);
      }
      if (values.length === 0) {
        return result;
      }

      if (readModel instanceof InMemoryInventoryReadModel) {
        const wanted = new Set(values.map((sku) => sku.value));
        for (const row of readModel.listOrganizationSnapshots(
          organizationId,
          LocationId.DEFAULT,
        )) {
          if (wanted.has(row.sku.value)) {
            result.set(row.sku.value, row.snapshot.toOrder);
          }
        }
        return result;
      }

      await Promise.all(
        values.map(async (sku) => {
          const snapshot = await readModel.getSnapshot(sku, LocationId.DEFAULT, organizationId);
          result.set(sku.value, snapshot.toOrder);
        }),
      );
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
