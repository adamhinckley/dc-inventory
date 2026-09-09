import type {
  OrganizationId,
  ProductId,
  Sku,
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

  async findByIds(
    _organizationId: OrganizationId,
    productIds: readonly ProductId[],
    _options?: { includeQty?: boolean },
  ): Promise<ReadonlyMap<string, ProductSnapshot>> {
    const result = new Map<string, ProductSnapshot>();
    for (const productId of productIds) {
      const product = this.products.get(productId);
      if (product !== undefined) {
        result.set(productId, product);
      }
    }
    return result;
  }

  async findBySku(
    organizationId: OrganizationId,
    sku: Sku,
  ): Promise<ProductSnapshot | null> {
    for (const product of this.products.values()) {
      if (product.organizationId === organizationId && product.sku.equals(sku)) {
        return product;
      }
    }
    return null;
  }

  add(product: ProductSnapshot): void {
    this.products.set(product.productId, product);
  }
}
