import type { OrganizationId, Sku } from "@dc-inventory/shared-kernel";
import type {
  IProductReorderReadPort,
  ProductReorderPolicy,
} from "../domain/ports/product-reorder-read.js";

export class InMemoryProductReorderReadPort implements IProductReorderReadPort {
  readonly bySku = new Map<string, ProductReorderPolicy>();

  async findByCatalogSku(
    _organizationId: OrganizationId,
    sku: Sku,
  ): Promise<ProductReorderPolicy | null> {
    return this.bySku.get(sku.value) ?? null;
  }
}
