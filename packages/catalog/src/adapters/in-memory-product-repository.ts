import type { ProductId, Sku } from "@dc-inventory/shared-kernel";
import type { Product } from "../domain/product.js";
import { isShopVisible } from "../domain/product.js";
import type {
  IProductRepository,
  ListedProduct,
  ProductListMatch,
} from "../domain/ports/product-repository.js";

type Stored = { product: Product; createdAt: Date };

export class InMemoryProductRepository implements IProductRepository {
  private readonly byId = new Map<ProductId, Stored>();

  async listMatching(query: ProductListMatch): Promise<ListedProduct[]> {
    const needle = query.q?.trim().toLowerCase() ?? "";
    return [...this.byId.values()].filter((row) => {
      if (query.inactive !== undefined && row.product.inactive !== query.inactive) {
        return false;
      }
      if (query.shopVisibleOnly === true && !isShopVisible(row.product)) {
        return false;
      }
      if (needle.length === 0) {
        return true;
      }
      return (
        row.product.sku.value.toLowerCase().includes(needle) ||
        row.product.name.toLowerCase().includes(needle)
      );
    });
  }

  async findById(id: ProductId): Promise<Product | null> {
    return this.byId.get(id)?.product ?? null;
  }

  async findBySku(sku: Sku): Promise<Product | null> {
    for (const row of this.byId.values()) {
      if (row.product.sku.equals(sku)) {
        return row.product;
      }
    }
    return null;
  }

  async save(product: Product): Promise<void> {
    const existing = this.byId.get(product.id);
    this.byId.set(product.id, {
      product,
      createdAt: existing?.createdAt ?? new Date(),
    });
  }
}
