import type { ProductId, Sku } from "@dc-inventory/shared-kernel";
import type { Product } from "../product.js";

export type ProductListMatch = {
  q?: string;
  inactive?: boolean;
  shopVisibleOnly?: boolean;
};

export type ListedProduct = {
  product: Product;
  createdAt: Date;
};

export interface IProductRepository {
  listMatching(query: ProductListMatch): Promise<ListedProduct[]>;
  findById(id: ProductId): Promise<Product | null>;
  findBySku(sku: Sku): Promise<Product | null>;
  save(product: Product): Promise<void>;
}
