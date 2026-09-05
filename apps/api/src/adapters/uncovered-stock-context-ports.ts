import type {
  IProductPackagingRepository,
  IProductRepository,
} from "@dc-inventory/catalog";
import type {
  IUncoveredCaseQtyReadPort,
  IUncoveredReorderPolicyReadPort,
} from "@dc-inventory/inventory";
import { locations, reorderPolicies } from "@dc-inventory/inventory/schema";
import { LocationId, type OrganizationId, type Sku } from "@dc-inventory/shared-kernel";
import { and, eq, inArray } from "drizzle-orm";
import type { AppDrizzle } from "../infrastructure/db.js";

const DEFAULT_LOCATION_CODE = "DEFAULT";

function uniqueSkus(skus: readonly Sku[]): Sku[] {
  return [...new Map(skus.map((sku) => [sku.value, sku])).values()];
}

export function uncoveredCaseQtyReadPort(
  productRepo: IProductRepository,
  packaging: IProductPackagingRepository,
): IUncoveredCaseQtyReadPort {
  return {
    async readBySkus(organizationId: OrganizationId, skus: readonly Sku[]) {
      const rows = new Map<string, { caseQty: number | null }>();
      for (const sku of uniqueSkus(skus)) {
        const product = await productRepo.findBySku(organizationId, sku);
        if (product === null) {
          rows.set(sku.value, { caseQty: null });
          continue;
        }
        const pack = await packaging.findByProductId(product.id);
        rows.set(sku.value, { caseQty: pack?.caseQty ?? null });
      }
      return rows;
    },
  };
}

export function uncoveredReorderPolicyReadPort(
  db: AppDrizzle,
): IUncoveredReorderPolicyReadPort {
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
