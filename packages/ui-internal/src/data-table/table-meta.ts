/** Filter widgets declared on OpenAPI `x-table.filters[].control`. */
export type TableFilterControl =
  | "select"
  | "text"
  | "date"
  | "dateRange"
  | "boolean";

export type TableColumnMeta = {
  field: string;
  label: string;
};

export type TableSearchMeta = {
  param: string;
  fields: readonly string[];
  placeholder: string;
};

export type TableFilterMeta = {
  param: string;
  control: TableFilterControl;
  /** Present when `control` is `dateRange`. Pair query param (e.g. `createdTo`). */
  rangePair?: string;
};

export type TableSortMeta = {
  defaultBy: string;
  defaultOrder: "asc" | "desc";
  fields: readonly string[];
};

export type TableExportMeta = {
  formats: readonly ("csv" | "xlsx")[];
};

export type TableImportMeta = {
  template: boolean;
};

/**
 * Generated OpenAPI `x-table` shape consumed by `DataTable` (`columns`, `search`,
 * `filters`, `sort`).
 *
 * Use this type for generated or copied list meta on internal dashboard pages.
 * Do not invent filters or columns that are not on the operation’s `x-table`.
 *
 * Import from `@dc-inventory/ui-internal`.
 *
 * @example
 * ```ts
 * import type { TableMeta } from "@dc-inventory/ui-internal";
 *
 * export const productsListTable = {
 *   rowId: "id",
 *   columns: [{ field: "sku", label: "SKU" }],
 *   search: { param: "q", fields: ["sku", "name"], placeholder: "Search SKU or name" },
 *   filters: [{ param: "status", control: "select" }],
 *   sort: { defaultBy: "sku", defaultOrder: "asc", fields: ["sku", "name"] },
 * } as const satisfies TableMeta;
 * ```
 */
export type TableMeta = {
  rowId: string;
  columns: readonly TableColumnMeta[];
  search?: TableSearchMeta;
  filters: readonly TableFilterMeta[];
  sort: TableSortMeta;
  export?: TableExportMeta;
  import?: TableImportMeta;
};
