import type { OrganizationId } from "@dc-inventory/shared-kernel";
import type { Product } from "../product.js";
import type { ProductQty } from "../qty.js";

export type CatalogListSortBy = "sku" | "name" | "onHand" | "available" | "createdAt";
export type CatalogListSortOrder = "asc" | "desc";

export type CatalogListQuery = {
  organizationId: OrganizationId;
  q?: string;
  page: number;
  pageSize: number;
  sortBy: CatalogListSortBy;
  sortOrder: CatalogListSortOrder;
  inactive?: boolean;
  shopVisibleOnly?: boolean;
};

export type CatalogListRow = {
  product: Product;
  qty: ProductQty;
  createdAt: Date;
};

export type CatalogListPage = {
  items: readonly CatalogListRow[];
  total: number;
};

/**
 * Catalog's paged read boundary. PostgreSQL implementations may join the
 * Inventory-owned stock projection, but stock remains movement-derived.
 */
export interface ICatalogListQuery {
  list(query: CatalogListQuery): Promise<CatalogListPage>;
}
