import type {
  OrganizationId,
  ProductId,
} from "@dc-inventory/shared-kernel";
import type {
  ICatalogProductPort,
  ProductSnapshot,
} from "../domain/ports/catalog-product.js";

export class InMemoryCatalogProductPort implements ICatalogProductPort {
  private readonly products = new Map<ProductId, ProductSnapshot>();

  constructor(products: readonly ProductSnapshot[] = []) {
    for (const product of products) {
      this.products.set(product.productId, product);
    }
  }

  async findById(
    _organizationId: OrganizationId,
    productId: ProductId,
  ): Promise<ProductSnapshot | null> {
    return this.products.get(productId) ?? null;
  }

  add(product: ProductSnapshot): void {
    this.products.set(product.productId, product);
  }
}
