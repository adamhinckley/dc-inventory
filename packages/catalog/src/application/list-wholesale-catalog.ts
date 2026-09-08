import type { CustomerId, OrganizationId } from "@dc-inventory/shared-kernel";
import type { ICatalogListQuery } from "../domain/ports/catalog-list-query.js";
import type { Product } from "../domain/product.js";
import type { ProductQty } from "../domain/qty.js";

export type WholesaleCatalogSortBy = "name" | "available";
export type SortOrder = "asc" | "desc";

export type ListWholesaleCatalogRequest = {
  organizationId: OrganizationId;
  customerId: CustomerId;
  q?: string;
  category?: string;
  page: number;
  pageSize: number;
  sortBy: WholesaleCatalogSortBy;
  sortOrder: SortOrder;
  availableOnly?: boolean;
};

export type WholesaleCatalogListRow = {
  product: Product;
  qty: ProductQty;
};

export type ListWholesaleCatalogResult = {
  items: WholesaleCatalogListRow[];
  page: number;
  pageSize: number;
  total: number;
};

export class ListWholesaleCatalogUseCase {
  constructor(private readonly catalogList: ICatalogListQuery) {}

  async execute(
    input: ListWholesaleCatalogRequest,
  ): Promise<ListWholesaleCatalogResult> {
    void input.customerId;
    const page = await this.catalogList.list({
      organizationId: input.organizationId,
      q: input.q,
      category: input.category === undefined ? undefined : [input.category],
      page: input.page,
      pageSize: input.pageSize,
      sortBy: input.sortBy,
      sortOrder: input.sortOrder,
      shopVisibleOnly: true,
      availableOnly: input.availableOnly ?? true,
      hideBeforeOpen: true,
    });
    return {
      items: page.items.map(({ product, qty }) => ({ product, qty })),
      page: input.page,
      pageSize: input.pageSize,
      total: page.total,
    };
  }
}
