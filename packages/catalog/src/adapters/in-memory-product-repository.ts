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
  private readonly categoriesByProductId = new Map<ProductId, Set<string>>();
  private readonly supplierIdsByProductId = new Map<ProductId, Set<string>>();

  async listMatching(query: ProductListMatch): Promise<ListedProduct[]> {
    const needle = query.q?.trim().toLowerCase() ?? "";
    const categories = (query.category ?? [])
      .map((name) => name.trim())
      .filter((name) => name.length > 0);
    const supplierIds = (query.supplierId ?? [])
      .map((id) => id.trim())
      .filter((id) => id.length > 0);
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
      if (categories.length > 0) {
        const assigned = this.categoriesByProductId.get(row.product.id);
        if (!categories.some((name) => assigned?.has(name))) {
          return false;
        }
      }
      if (supplierIds.length > 0) {
        const assigned = this.supplierIdsByProductId.get(row.product.id);
        if (!supplierIds.some((id) => assigned?.has(id))) {
          return false;
        }
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

  setCategories(productId: ProductId, categories: Iterable<string>): void {
    this.categoriesByProductId.set(productId, new Set(categories));
  }

  setSupplierIds(productId: ProductId, supplierIds: Iterable<string>): void {
    this.supplierIdsByProductId.set(productId, new Set(supplierIds));
  }

  async listCategoryNames(organizationId: OrganizationId): Promise<string[]> {
    const names = new Set<string>();
    for (const [productId, categories] of this.categoriesByProductId) {
      const row = this.byId.get(productId);
      if (row === undefined || row.product.organizationId !== organizationId) {
        continue;
      }
      for (const name of categories) {
        names.add(name);
      }
    }
    return [...names].sort((left, right) => left.localeCompare(right));
  }

  async findById(organizationId: OrganizationId, id: ProductId): Promise<Product | null> {
    const row = this.byId.get(id);
    if (row === undefined || row.product.organizationId !== organizationId) {
      return null;
    }
    return row.product;
  }

  async findByIds(
    organizationId: OrganizationId,
    ids: readonly ProductId[],
  ): Promise<ReadonlyMap<string, Product>> {
    const result = new Map<string, Product>();
    for (const id of ids) {
      const product = await this.findById(organizationId, id);
      if (product !== null) {
        result.set(id, product);
      }
    }
    return result;
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

  async findBySkus(
    organizationId: OrganizationId,
    skus: readonly Sku[],
  ): Promise<ReadonlyMap<string, Product>> {
    const result = new Map<string, Product>();
    for (const sku of skus) {
      const product = await this.findBySku(organizationId, sku);
      if (product !== null) {
        result.set(sku.value, product);
      }
    }
    return result;
  }

  async save(product: Product): Promise<void> {
    const existing = this.byId.get(product.id);
    this.byId.set(product.id, {
      product,
      createdAt: existing?.createdAt ?? new Date(),
    });
  }

  async saveMany(productsList: readonly Product[]): Promise<void> {
    for (const product of productsList) {
      await this.save(product);
    }
  }
}
