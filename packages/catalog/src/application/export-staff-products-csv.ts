import type { OrganizationId, StaffUserId } from "@dc-inventory/shared-kernel";
import type { ICatalogCsvWriter } from "../domain/ports/catalog-csv-writer.js";
import type {
  CatalogListSortBy,
  CatalogListSortOrder,
  ICatalogListQuery,
} from "../domain/ports/catalog-list-query.js";
import type { CatalogListRow } from "../domain/ports/catalog-list-query.js";

export const STAFF_PRODUCTS_EXPORT_ROW_CAP = 10_000;

export const STAFF_PRODUCTS_CSV_COLUMNS = [
  { key: "sku", header: "SKU" },
  { key: "name", header: "Name" },
  { key: "listPrice", header: "List price" },
  { key: "lastPoCostCents", header: "Unit cost" },
  { key: "inactive", header: "Inactive" },
  { key: "discontinued", header: "Discontinued" },
  { key: "webWholesale", header: "Web wholesale" },
] as const;

export type ExportStaffProductsCsvRequest = {
  organizationId: OrganizationId;
  staffUserId: StaffUserId;
  q?: string;
  sortBy: CatalogListSortBy;
  sortOrder: CatalogListSortOrder;
  inactive?: boolean;
  hideZeroInventory?: boolean;
};

export type ExportStaffProductsCsvResult = {
  file: {
    bytes: Uint8Array;
    contentType: string;
    filename: string;
  };
  rowCount: number;
  truncated: boolean;
};

function csvRow(row: CatalogListRow): Record<string, string> {
  return {
    sku: row.product.sku.value,
    name: row.product.name,
    listPrice:
      row.product.listPrice === null ? "" : String(row.product.listPrice.amountMinor),
    lastPoCostCents:
      row.lastPoCostCents === null ? "" : String(row.lastPoCostCents),
    inactive: String(row.product.inactive),
    discontinued: String(row.product.discontinued),
    webWholesale: String(row.product.webWholesale),
  };
}

export class ExportStaffProductsCsvUseCase {
  constructor(
    private readonly catalogList: ICatalogListQuery,
    private readonly csvWriter: ICatalogCsvWriter,
  ) {}

  async execute(
    input: ExportStaffProductsCsvRequest,
  ): Promise<ExportStaffProductsCsvResult> {
    void input.staffUserId;
    const page = await this.catalogList.list({
      organizationId: input.organizationId,
      q: input.q,
      page: 1,
      pageSize: STAFF_PRODUCTS_EXPORT_ROW_CAP,
      sortBy: input.sortBy,
      sortOrder: input.sortOrder,
      inactive: input.inactive,
      hideZeroInventory: input.hideZeroInventory,
    });
    const file = await this.csvWriter.write({
      filename: "products.csv",
      columns: STAFF_PRODUCTS_CSV_COLUMNS,
      rows: page.items.map(csvRow),
    });
    return {
      file,
      rowCount: page.items.length,
      truncated: page.total > page.items.length,
    };
  }
}
