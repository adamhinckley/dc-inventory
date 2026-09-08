import type { OrganizationId } from "@dc-inventory/shared-kernel";
import type { Product } from "../product.js";
import type { ProductQty } from "../qty.js";

export type CatalogListSortBy =
  | "sku"
  | "name"
  | "onHand"
  | "onOrder"
  | "allocated"
  | "available"
  | "committed"
  | "availableToSell"
  | "sellState"
  | "caseQty"
  | "createdAt";
export type CatalogListSortOrder = "asc" | "desc";

export type CatalogListQuery = {
  organizationId: OrganizationId;
  q?: string;
  category?: readonly string[];
  supplierId?: readonly string[];
  excludeSupplierId?: readonly string[];
  page: number;
  pageSize: number;
  sortBy: CatalogListSortBy;
  sortOrder: CatalogListSortOrder;
  inactive?: boolean;
  shopVisibleOnly?: boolean;
  /** When true, omit SKUs whose snapshot qty is all zero. */
  hideZeroInventory?: boolean;
  /** When true, include every open SKU; omit locked SKUs with ATP ≤ 0. */
  availableOnly?: boolean;
  /** Effective sell state (sticky lock or sell window vs now). */
  sellState?: "open" | "locked";
};

export type CatalogListRow = {
  product: Product;
  qty: ProductQty;
  createdAt: Date;
  caseQty: number | null;
  /** Latest PO unit cost from supplier × SKU (`po_cost` on import). */
  lastPoCostCents: number | null;
  /** Linked factory names, comma-separated when a SKU has more than one. */
  supplierName: string | null;
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
