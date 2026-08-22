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
 * `DataTable` renders only columns / search / filters listed here.
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
