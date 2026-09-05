/** Filter widgets declared on OpenAPI `x-table.filters[].control`. */
export type TableFilterControl =
  | "select"
  | "multiselect"
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
 * import { listInternalProductsTable } from "@dc-inventory/api-client-internal";
 * import type { TableMeta } from "@dc-inventory/ui-internal";
 *
 * const meta: TableMeta = listInternalProductsTable;
 * ```
 */
export type TableMeta = {
  rowId: string;
  columns: readonly TableColumnMeta[];
  search?: TableSearchMeta;
  filters?: readonly TableFilterMeta[];
  sort?: TableSortMeta;
  export?: TableExportMeta;
  import?: TableImportMeta;
};

/**
 * Form-control id prefix for one `DataTable.Root`.
 * Derived from `x-table` meta so SSR HTML matches hydration (`useId` does not).
 * Pass `idPrefix` whenever more than one Root renders on a page. Derived prefixes
 * can still collide across different metas that share search, filter, sort,
 * rowId, and column-field tokens.
 */
export function tableControlIdBase(meta: TableMeta, idPrefix?: string): string {
  if (idPrefix !== undefined && idPrefix.length > 0) {
    return idPrefix;
  }
  const tokens = [
    meta.search?.param,
    ...(meta.filters ?? []).map((filter) => filter.param),
    meta.sort?.defaultBy,
    meta.rowId,
    ...meta.columns.map((column) => column.field),
  ].filter((token): token is string => token !== undefined && token.length > 0);
  return `dt-${tokens.join("-")}`;
}
