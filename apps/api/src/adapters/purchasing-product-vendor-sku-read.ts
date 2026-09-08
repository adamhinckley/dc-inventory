import type { IProductVendorSkuReadPort } from "@dc-inventory/catalog";
import type { PurchasingDrizzle } from "@dc-inventory/purchasing";
import { supplierProducts, suppliers } from "@dc-inventory/purchasing/schema";
import type { OrganizationId, Sku } from "@dc-inventory/shared-kernel";
import { and, eq } from "drizzle-orm";

export class PurchasingProductVendorSkuReadAdapter implements IProductVendorSkuReadPort {
  constructor(private readonly db: PurchasingDrizzle) {}

  async findVendorSkuByCatalogSku(
    organizationId: OrganizationId,
    sku: Sku,
  ): Promise<string | null> {
    const rows = await this.db
      .select({ supplierSku: supplierProducts.supplierSku })
      .from(supplierProducts)
      .innerJoin(suppliers, eq(supplierProducts.supplierId, suppliers.id))
      .where(
        and(
          eq(suppliers.organizationId, organizationId),
          eq(supplierProducts.sku, sku.value),
        ),
      )
      .limit(1);
    const value = rows[0]?.supplierSku?.trim() ?? "";
    return value.length === 0 ? null : value;
  }
}
