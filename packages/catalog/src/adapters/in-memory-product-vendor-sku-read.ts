import type { OrganizationId, Sku } from "@dc-inventory/shared-kernel";
import type { IProductVendorSkuReadPort } from "../domain/ports/product-vendor-sku-read.js";

export class InMemoryProductVendorSkuReadPort implements IProductVendorSkuReadPort {
  readonly bySku = new Map<string, string>();

  async findVendorSkuByCatalogSku(
    _organizationId: OrganizationId,
    sku: Sku,
  ): Promise<string | null> {
    return this.bySku.get(sku.value) ?? null;
  }
}
