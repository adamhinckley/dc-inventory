import type { OrganizationId, StaffUserId } from "@dc-inventory/shared-kernel";
import type {
  CatalogListSortBy,
  CatalogListSortOrder,
  ICatalogListQuery,
} from "../domain/ports/catalog-list-query.js";
import type { Product } from "../domain/product.js";
import type { ProductQty } from "../domain/qty.js";

export type StaffProductSortBy = CatalogListSortBy;
export type SortOrder = CatalogListSortOrder;

export type ListStaffProductsRequest = {
  organizationId: OrganizationId;
  staffUserId: StaffUserId;
  q?: string;
  category?: readonly string[];
  supplierId?: readonly string[];
  page: number;
  pageSize: number;
  sortBy: StaffProductSortBy;
  sortOrder: SortOrder;
  inactive?: boolean;
  hideZeroInventory?: boolean;
  sellState?: "open" | "locked";
};

export type StaffProductListRow = {
  product: Product;
  qty: ProductQty;
  createdAt: Date;
  caseQty: number | null;
  lastPoCostCents: number | null;
  supplierName: string | null;
};

export type ListStaffProductsResult = {
  items: StaffProductListRow[];
  page: number;
  pageSize: number;
  total: number;
};

export class ListStaffProductsUseCase {
  constructor(private readonly catalogList: ICatalogListQuery) {}

  async execute(input: ListStaffProductsRequest): Promise<ListStaffProductsResult> {
    void input.staffUserId;
    const page = await this.catalogList.list({
      organizationId: input.organizationId,
      q: input.q,
      category: input.category,
      supplierId: input.supplierId,
      page: input.page,
      pageSize: input.pageSize,
      sortBy: input.sortBy,
      sortOrder: input.sortOrder,
      inactive: input.inactive,
      hideZeroInventory: input.hideZeroInventory,
      sellState: input.sellState,
    });
    return {
      items: [...page.items],
      page: input.page,
      pageSize: input.pageSize,
      total: page.total,
    };
  }
}
