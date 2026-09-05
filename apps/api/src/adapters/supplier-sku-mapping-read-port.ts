import type { ISupplierSkuMappingReadPort } from "@dc-inventory/purchasing";
import { supplierProducts, suppliers } from "@dc-inventory/purchasing/schema";
import { Sku, SupplierId, type OrganizationId } from "@dc-inventory/shared-kernel";
import { and, eq } from "drizzle-orm";
import type { PurchasingDrizzle } from "@dc-inventory/purchasing";

export function supplierSkuMappingReadPort(
  db: PurchasingDrizzle,
): ISupplierSkuMappingReadPort {
  return {
    async findSupplierForSku(organizationId: OrganizationId, sku: Sku) {
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
      if (rows.length !== 1) {
        return null;
      }
      const row = rows[0];
      if (row === undefined) {
        return null;
      }
      return SupplierId.parse(row.supplierId);
    },
  };
}
