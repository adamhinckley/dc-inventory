import type {
  IProductPrimarySupplierReadPort,
  ProductPrimarySupplierTerms,
} from "@dc-inventory/catalog";
import type { PurchasingDrizzle } from "@dc-inventory/purchasing";
import { supplierProducts, suppliers } from "@dc-inventory/purchasing/schema";
import type { OrganizationId, Sku } from "@dc-inventory/shared-kernel";
import { and, eq } from "drizzle-orm";

export class PurchasingProductPrimarySupplierReadAdapter
  implements IProductPrimarySupplierReadPort
{
  constructor(private readonly db: PurchasingDrizzle) {}

  async findByCatalogSku(
    organizationId: OrganizationId,
    sku: Sku,
  ): Promise<ProductPrimarySupplierTerms | null> {
    const rows = await this.db
      .select({
        vendorNumber: suppliers.vendorNumber,
        vendorName: suppliers.name,
        supplierSku: supplierProducts.supplierSku,
        minOrderQty: supplierProducts.minOrderQty,
        minOrderAmountCents: supplierProducts.minOrderAmountCents,
        lastPoCostCents: supplierProducts.lastPoCostCents,
      })
      .from(supplierProducts)
      .innerJoin(suppliers, eq(supplierProducts.supplierId, suppliers.id))
      .where(
        and(
          eq(suppliers.organizationId, organizationId),
          eq(supplierProducts.sku, sku.value),
        ),
      )
      .limit(1);
    const row = rows[0];
    if (row === undefined) {
      return null;
    }
    return {
      vendorNumber: row.vendorNumber,
      vendorName: row.vendorName,
      supplierSku: normalizeOptional(row.supplierSku),
      minOrderQty: row.minOrderQty,
      minOrderAmountCents: row.minOrderAmountCents,
      lastPoCostCents: row.lastPoCostCents,
    };
  }
}

function normalizeOptional(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length === 0 ? null : trimmed;
}
