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

  async findByProductIds(
    productIds: readonly ProductId[],
  ): Promise<ReadonlyMap<string, ProductPackaging>> {
    const unique = [...new Map(productIds.map((productId) => [productId, productId])).values()];
    const rows = new Map<string, ProductPackaging>();
    for (const productId of unique) {
      const packaging = this.byProductId.get(productId);
      if (packaging !== undefined) {
        rows.set(productId, packaging);
      }
    }
    return rows;
  }

  async save(packaging: ProductPackaging): Promise<void> {
    this.byProductId.set(packaging.productId, { ...packaging });
  }

  async saveMany(packagingList: readonly ProductPackaging[]): Promise<void> {
    for (const packaging of packagingList) {
      await this.save(packaging);
    }
  }
}
