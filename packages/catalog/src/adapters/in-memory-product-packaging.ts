import type { ProductId } from "@dc-inventory/shared-kernel";
import type {
  IProductPackagingRepository,
  ProductPackaging,
} from "../domain/ports/product-packaging.js";

export class InMemoryProductPackagingRepository implements IProductPackagingRepository {
  private readonly byProductId = new Map<ProductId, ProductPackaging>();

  async findByProductId(productId: ProductId): Promise<ProductPackaging | null> {
    return this.byProductId.get(productId) ?? null;
  }

  async save(packaging: ProductPackaging): Promise<void> {
    this.byProductId.set(packaging.productId, {
      productId: packaging.productId,
      caseQty: packaging.caseQty,
      caseLength: packaging.caseLength,
      caseWidth: packaging.caseWidth,
      caseHeight: packaging.caseHeight,
    });
  }
}
