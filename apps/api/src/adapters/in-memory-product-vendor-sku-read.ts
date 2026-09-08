import type { IProductVendorSkuReadPort } from "@dc-inventory/catalog";
import type { InMemorySupplierProductRepository } from "@dc-inventory/purchasing";
import type { OrganizationId, Sku } from "@dc-inventory/shared-kernel";

export class InMemoryPurchasingProductVendorSkuReadAdapter
  implements IProductVendorSkuReadPort
{
  constructor(private readonly supplierProducts: InMemorySupplierProductRepository) {}

  async findVendorSkuByCatalogSku(
    _organizationId: OrganizationId,
    sku: Sku,
  ): Promise<string | null> {
    const row = (await this.supplierProducts.listAll()).find(
      (product) => product.sku.value === sku.value,
    );
    const value = row?.supplierSku?.trim() ?? "";
    return value.length === 0 ? null : value;
  }
}
