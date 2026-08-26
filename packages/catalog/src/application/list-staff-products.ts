import type { StaffUserId } from "@dc-inventory/shared-kernel";
import type { IProductRepository } from "../domain/ports/product-repository.js";
import type { IQtyReadPort } from "../domain/ports/qty-read.js";
import type { Product } from "../domain/product.js";
import { ZERO_QTY, type ProductQty } from "../domain/qty.js";

export type StaffProductSortBy = "sku" | "name" | "onHand" | "available" | "createdAt";
export type SortOrder = "asc" | "desc";

export type ListStaffProductsRequest = {
  staffUserId: StaffUserId;
  q?: string;
  page: number;
  pageSize: number;
  sortBy: StaffProductSortBy;
  sortOrder: SortOrder;
  inactive?: boolean;
};

export type StaffProductListRow = {
  product: Product;
  qty: ProductQty;
};

export type ListStaffProductsResult = {
  items: StaffProductListRow[];
  page: number;
  pageSize: number;
  total: number;
};

export class ListStaffProductsUseCase {
  constructor(
    private readonly products: IProductRepository,
    private readonly qty: IQtyReadPort,
  ) {}

  async execute(input: ListStaffProductsRequest): Promise<ListStaffProductsResult> {
    void input.staffUserId;
    const listed = await this.products.listMatching({
      q: input.q,
      inactive: input.inactive,
    });
    const snapshots = await this.qty.readBySkus(
      listed.map((row) => row.product.sku),
    );
    const createdAtById = new Map(
      listed.map((row) => [row.product.id, row.createdAt.getTime()] as const),
    );
    const rows: StaffProductListRow[] = listed.map((row) => ({
      product: row.product,
      qty: snapshots.get(row.product.sku.value) ?? ZERO_QTY,
    }));
    rows.sort((a, b) => {
      let cmp = 0;
      if (input.sortBy === "sku") {
        cmp = a.product.sku.value.localeCompare(b.product.sku.value);
      } else if (input.sortBy === "name") {
        cmp = a.product.name.localeCompare(b.product.name);
      } else if (input.sortBy === "onHand") {
        cmp = a.qty.onHand - b.qty.onHand;
      } else if (input.sortBy === "available") {
        cmp = a.qty.available - b.qty.available;
      } else {
        cmp = (createdAtById.get(a.product.id) ?? 0) - (createdAtById.get(b.product.id) ?? 0);
      }
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
