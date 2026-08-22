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
 * Generated `x-table` shape (`productsListTable.ts` after codegen).
 *
 * When to use: pass this object as `DataTable.Root` `meta` so chrome only
 * renders columns / search / filters the operation declared.
 *
 * When not to use: do not hand-author extra filters here — add them on the
 * OpenAPI `x-table` and regenerate.
 *
 * Import from `@dc-inventory/ui-internal`.
 *
 * @example
 * ```ts
 * import type { TableMeta } from "@dc-inventory/ui-internal";
 * import { productsListTable } from "../lib/products-list-table";
 *
 * const meta: TableMeta = productsListTable;
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
