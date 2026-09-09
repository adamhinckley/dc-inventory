import type { OrganizationId, ProductId, Sku } from "@dc-inventory/shared-kernel";
import type { Product } from "../product.js";

export type ProductListMatch = {
  organizationId: OrganizationId;
  q?: string;
  category?: readonly string[];
  supplierId?: readonly string[];
  excludeSupplierId?: readonly string[];
  inactive?: boolean;
  shopVisibleOnly?: boolean;
};

export type ListedProduct = {
  product: Product;
  createdAt: Date;
};

export type CategoryNamesMatch = {
  /** Only categories with at least one shop-visible product (wholesale nav). */
  shopVisibleOnly?: boolean;
};

export interface IProductRepository {
  listMatching(query: ProductListMatch): Promise<ListedProduct[]>;
  listCategoryNames(
    organizationId: OrganizationId,
    match?: CategoryNamesMatch,
  ): Promise<string[]>;
  findById(organizationId: OrganizationId, id: ProductId): Promise<Product | null>;
  findByIds(
    organizationId: OrganizationId,
    ids: readonly ProductId[],
  ): Promise<ReadonlyMap<string, Product>>;
  findBySku(organizationId: OrganizationId, sku: Sku): Promise<Product | null>;
  findBySkus(
    organizationId: OrganizationId,
    skus: readonly Sku[],
  ): Promise<ReadonlyMap<string, Product>>;
  save(product: Product): Promise<void>;
  saveMany(products: readonly Product[]): Promise<void>;
}
