import type { ISupplierSkuMappingReadPort } from "@dc-inventory/purchasing";
import { supplierProducts, suppliers } from "@dc-inventory/purchasing/schema";
import { Sku, SupplierId, type OrganizationId } from "@dc-inventory/shared-kernel";
import { and, eq, inArray } from "drizzle-orm";
import type { PurchasingDrizzle } from "@dc-inventory/purchasing";
import { resolveSupplierSkuMapping, type SupplierSkuMapping } from "@dc-inventory/purchasing";

export function supplierSkuMappingReadPort(
  db: PurchasingDrizzle,
): ISupplierSkuMappingReadPort {
  async function supplierIdsForSku(
    organizationId: OrganizationId,
    sku: Sku,
  ): Promise<SupplierId[]> {
    const rows = await db
      .select({ supplierId: supplierProducts.supplierId })
      .from(supplierProducts)
      .innerJoin(suppliers, eq(supplierProducts.supplierId, suppliers.id))
      .where(
        and(
          eq(suppliers.organizationId, organizationId),
          eq(supplierProducts.sku, sku.value),
        ),
      );
    return rows.map((row) => SupplierId.parse(row.supplierId));
  }

  async function getSkuMapping(
    organizationId: OrganizationId,
    sku: Sku,
  ): Promise<SupplierSkuMapping> {
    return resolveSupplierSkuMapping(await supplierIdsForSku(organizationId, sku));
  }

  async function supplierIdsBySkus(
    organizationId: OrganizationId,
    skus: readonly Sku[],
  ): Promise<Map<string, SupplierId[]>> {
    const bySku = new Map<string, SupplierId[]>();
    if (skus.length === 0) {
      return bySku;
    }
    const rows = await db
      .select({
        sku: supplierProducts.sku,
        supplierId: supplierProducts.supplierId,
      })
      .from(supplierProducts)
      .innerJoin(suppliers, eq(supplierProducts.supplierId, suppliers.id))
      .where(
        and(
          eq(suppliers.organizationId, organizationId),
          inArray(
            supplierProducts.sku,
            skus.map((sku) => sku.value),
          ),
        ),
      );
    for (const row of rows) {
      const supplierId = SupplierId.parse(row.supplierId);
      const existing = bySku.get(row.sku) ?? [];
      existing.push(supplierId);
      bySku.set(row.sku, existing);
    }
    return bySku;
  }

  return {
    async findSupplierForSku(organizationId: OrganizationId, sku: Sku) {
      const mapping = await getSkuMapping(organizationId, sku);
      return mapping.supplierId;
    },

    getSkuMapping,

    async getSkuMappings(
      organizationId: OrganizationId,
      skus: readonly Sku[],
    ): Promise<ReadonlyMap<string, SupplierSkuMapping>> {
      const mappings = new Map<string, SupplierSkuMapping>();
      if (skus.length === 0) {
        return mappings;
      }
      const supplierIdsBySku = await supplierIdsBySkus(organizationId, skus);
      for (const sku of skus) {
        mappings.set(
          sku.value,
          resolveSupplierSkuMapping(supplierIdsBySku.get(sku.value) ?? []),
        );
      }
      return mappings;
    },
  };
}
