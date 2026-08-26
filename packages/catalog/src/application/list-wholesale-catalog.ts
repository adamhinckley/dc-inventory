import type { CustomerId, OrganizationId } from "@dc-inventory/shared-kernel";
import type { IProductRepository } from "../domain/ports/product-repository.js";
import type { IQtyReadPort } from "../domain/ports/qty-read.js";
import type { Product } from "../domain/product.js";
import { ZERO_QTY, type ProductQty } from "../domain/qty.js";

export type WholesaleCatalogSortBy = "name" | "available";
export type SortOrder = "asc" | "desc";

export type ListWholesaleCatalogRequest = {
  organizationId: OrganizationId;
  customerId: CustomerId;
  q?: string;
  page: number;
  pageSize: number;
  sortBy: WholesaleCatalogSortBy;
  sortOrder: SortOrder;
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
  constructor(
    private readonly products: IProductRepository,
    private readonly qty: IQtyReadPort,
  ) {}

  async execute(
    input: ListWholesaleCatalogRequest,
  ): Promise<ListWholesaleCatalogResult> {
    void input.customerId;
    const listed = await this.products.listMatching({
      organizationId: input.organizationId,
      q: input.q,
      shopVisibleOnly: true,
    });
    const snapshots = await this.qty.readBySkus(
      listed.map((row) => row.product.sku),
    );
    const rows: WholesaleCatalogListRow[] = listed.map((row) => ({
      product: row.product,
      qty: snapshots.get(row.product.sku.value) ?? ZERO_QTY,
    }));
    rows.sort((a, b) => {
      const cmp =
        input.sortBy === "available"
          ? a.qty.available - b.qty.available
          : a.product.name.localeCompare(b.product.name);
      return input.sortOrder === "desc" ? -cmp : cmp;
    });
    const start = (input.page - 1) * input.pageSize;
    return {
      items: rows.slice(start, start + input.pageSize),
      page: input.page,
      pageSize: input.pageSize,
      total: rows.length,
    };
  }
}
