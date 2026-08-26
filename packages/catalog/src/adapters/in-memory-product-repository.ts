import type { OrganizationId, ProductId, Sku } from "@dc-inventory/shared-kernel";
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
      if (row.product.organizationId !== query.organizationId) {
        return false;
      }
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

  async findById(organizationId: OrganizationId, id: ProductId): Promise<Product | null> {
    const row = this.byId.get(id);
    if (row === undefined || row.product.organizationId !== organizationId) {
      return null;
    }
    return row.product;
  }

  async findBySku(organizationId: OrganizationId, sku: Sku): Promise<Product | null> {
    for (const row of this.byId.values()) {
      if (
        row.product.organizationId === organizationId &&
        row.product.sku.equals(sku)
      ) {
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
