import {
  compareStaffCatalogQtyAvailableToSell,
  compareStaffCatalogQtySellState,
} from "@dc-inventory/inventory";
import type {
  CatalogListQuery,
  CatalogListRow,
  ICatalogListQuery,
} from "../domain/ports/catalog-list-query.js";
import type { IProductRepository } from "../domain/ports/product-repository.js";
import type { IProductPackagingRepository } from "../domain/ports/product-packaging.js";
import type { IQtyReadPort } from "../domain/ports/qty-read.js";
import { isShopSellable, ZERO_QTY } from "../domain/qty.js";

function hasNonZeroInventoryQty(qty: typeof ZERO_QTY): boolean {
  return qty.onHand > 0 || qty.onOrder > 0 || qty.allocated > 0 || qty.committed > 0;
}

function compareRows(a: CatalogListRow, b: CatalogListRow, query: CatalogListQuery): number {
  let comparison = 0;
  if (query.sortBy === "sku") {
    comparison = a.product.sku.value.localeCompare(b.product.sku.value);
  } else if (query.sortBy === "name") {
    comparison = a.product.name.localeCompare(b.product.name);
  } else if (query.sortBy === "onHand") {
    comparison = a.qty.onHand - b.qty.onHand;
  } else if (query.sortBy === "onOrder") {
    comparison = a.qty.onOrder - b.qty.onOrder;
  } else if (query.sortBy === "allocated") {
    comparison = a.qty.allocated - b.qty.allocated;
  } else if (query.sortBy === "available") {
    comparison = a.qty.available - b.qty.available;
  } else if (query.sortBy === "committed") {
    comparison = a.qty.committed - b.qty.committed;
  } else if (query.sortBy === "availableToSell") {
    comparison = compareStaffCatalogQtyAvailableToSell(a.qty, b.qty, query.sortOrder);
  } else if (query.sortBy === "sellState") {
    comparison = compareStaffCatalogQtySellState(a.qty, b.qty);
  } else if (query.sortBy === "caseQty") {
    comparison = (a.caseQty ?? 0) - (b.caseQty ?? 0);
  } else {
    comparison = a.createdAt.getTime() - b.createdAt.getTime();
  }
  if (comparison !== 0) {
    if (query.sortBy === "availableToSell") {
      return comparison;
    }
    return query.sortOrder === "desc" ? -comparison : comparison;
  }
  return a.product.id.localeCompare(b.product.id);
}

export class InMemoryCatalogListQuery implements ICatalogListQuery {
  constructor(
    private readonly products: IProductRepository,
    private readonly qty: IQtyReadPort,
    private readonly packaging: IProductPackagingRepository,
  ) {}

  async list(query: CatalogListQuery) {
    const listed = await this.products.listMatching({
      organizationId: query.organizationId,
      q: query.q,
      category: query.category,
      inactive: query.inactive,
      shopVisibleOnly: query.shopVisibleOnly,
    });
    const snapshots = await this.qty.readBySkus(
      query.organizationId,
      listed.map((row) => row.product.sku),
    );
    const packs = await Promise.all(
      listed.map((row) => this.packaging.findByProductId(row.product.id)),
    );
    const rows = listed.map((row, index): CatalogListRow => ({
      product: row.product,
      qty: snapshots.get(row.product.sku.value) ?? ZERO_QTY,
      createdAt: row.createdAt,
      caseQty: packs[index]?.caseQty ?? null,
      lastPoCostCents: null,
    }));
    const visibleRows = rows.filter((row) => {
      if (query.hideZeroInventory === true && !hasNonZeroInventoryQty(row.qty)) {
        return false;
      }
      if (query.availableOnly === true && !isShopSellable(row.qty)) {
        return false;
      }
      return true;
    });
    visibleRows.sort((a, b) => compareRows(a, b, query));
    const offset = (query.page - 1) * query.pageSize;
    return {
      items: visibleRows.slice(offset, offset + query.pageSize),
      total: visibleRows.length,
    };
  }
}
