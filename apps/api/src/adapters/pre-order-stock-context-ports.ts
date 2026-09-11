import type {
  IProductPackagingRepository,
  IProductRepository,
} from "@dc-inventory/catalog";
import type {
  IPreOrderCaseQtyReadPort,
  IPreOrderReorderPolicyReadPort,
} from "@dc-inventory/inventory";
import { locations, reorderPolicies } from "@dc-inventory/inventory/schema";
import { LocationId, type OrganizationId, type Sku } from "@dc-inventory/shared-kernel";
import { and, eq, inArray } from "drizzle-orm";
import type { AppDrizzle } from "../infrastructure/db.js";
import { readCaseQtyBySkus } from "./catalog-case-qty-by-skus.js";

const DEFAULT_LOCATION_CODE = "DEFAULT";

function uniqueSkus(skus: readonly Sku[]): Sku[] {
  return [...new Map(skus.map((sku) => [sku.value, sku])).values()];
}

export function preOrderCaseQtyReadPort(
  productRepo: IProductRepository,
  packaging: IProductPackagingRepository,
): IPreOrderCaseQtyReadPort {
  return {
    readBySkus: (organizationId, skus) =>
      readCaseQtyBySkus(organizationId, skus, productRepo, packaging),
  };
}

export function preOrderReorderPolicyReadPort(
  db: AppDrizzle,
): IPreOrderReorderPolicyReadPort {
  return {
    async readBySkus(
      organizationId: OrganizationId,
      locationId: LocationId,
      skus: readonly Sku[],
    ) {
      const values = uniqueSkus(skus).map((sku) => sku.value);
      if (values.length === 0) {
        return new Map();
      }
      const locationRows = await db
        .select({ id: locations.id })
        .from(locations)
        .where(
          and(
            eq(locations.organizationId, organizationId),
            eq(
              locations.code,
              locationId === LocationId.DEFAULT ? DEFAULT_LOCATION_CODE : locationId,
            ),
          ),
        )
        .limit(1);
      const locationUuid = locationRows[0]?.id;
      if (locationUuid === undefined) {
        return new Map(
          values.map((sku) => [sku, { reorderMin: null, reorderMax: null }]),
        );
      }
      const rows = await db
        .select({
          sku: reorderPolicies.sku,
          reorderMin: reorderPolicies.minOnHand,
          reorderMax: reorderPolicies.maxOnHand,
        })
        .from(reorderPolicies)
        .where(
          and(
            eq(reorderPolicies.organizationId, organizationId),
            eq(reorderPolicies.locationId, locationUuid),
            inArray(reorderPolicies.sku, values),
          ),
        );
      const bySku = new Map(
        rows.map((row) => [
          row.sku,
          { reorderMin: row.reorderMin, reorderMax: row.reorderMax },
        ]),
      );
      return new Map(
        values.map((sku) => [
          sku,
          bySku.get(sku) ?? { reorderMin: null, reorderMax: null },
        ]),
      );
    },
  };
}
