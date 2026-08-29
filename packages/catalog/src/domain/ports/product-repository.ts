import type { OrganizationId, ProductId, Sku } from "@dc-inventory/shared-kernel";
import type { Product } from "../product.js";

export type ProductListMatch = {
  organizationId: OrganizationId;
  q?: string;
  category?: string;
  inactive?: boolean;
  shopVisibleOnly?: boolean;
};

export type ListedProduct = {
  product: Product;
  createdAt: Date;
};

export interface IProductRepository {
  listMatching(query: ProductListMatch): Promise<ListedProduct[]>;
  findById(organizationId: OrganizationId, id: ProductId): Promise<Product | null>;
  findBySku(organizationId: OrganizationId, sku: Sku): Promise<Product | null>;
  save(product: Product): Promise<void>;
}
