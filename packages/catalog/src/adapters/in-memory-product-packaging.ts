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
    this.byProductId.set(packaging.productId, { ...packaging });
  }

  async saveMany(packagingList: readonly ProductPackaging[]): Promise<void> {
    for (const packaging of packagingList) {
      await this.save(packaging);
    }
  }
}
