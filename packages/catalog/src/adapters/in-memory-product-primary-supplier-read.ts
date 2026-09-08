import type { OrganizationId, Sku } from "@dc-inventory/shared-kernel";
import type {
  IProductPrimarySupplierReadPort,
  ProductPrimarySupplierTerms,
} from "../domain/ports/product-primary-supplier-read.js";

export class InMemoryProductPrimarySupplierReadPort implements IProductPrimarySupplierReadPort {
  readonly bySku = new Map<string, ProductPrimarySupplierTerms>();

  async findByCatalogSku(
    _organizationId: OrganizationId,
    sku: Sku,
  ): Promise<ProductPrimarySupplierTerms | null> {
    return this.bySku.get(sku.value) ?? null;
  }
}
