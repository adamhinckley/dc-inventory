"use client";

import {
  Checkbox,
  Input,
  Label,
  formatMoneyMinorUnits,
  Table,
  TextInput,
  useTable,
  type TableColumnDef,
  type TableTooltip,
} from "@dc-inventory/ui";
import {
  createContext,
  useContext,
  useMemo,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import {
  type DataTableState,
  type ListQueryParams,
} from "./list-params";
import {
  tableControlIdBase,
  type TableFilterMeta,
  type TableMeta,
} from "./table-meta";
import { formatFieldDisplay, readFieldValue } from "./cell-value";
import {
  useDataTable,
  type ListQueryHook,
} from "./use-data-table";

export type FilterOption = {
  value: string;
  label: string;
};

export type DataTableRootProps<
  TParams = ListQueryParams,
  TRow = Record<string, unknown>,
> = {
  meta: TableMeta;
  queryHook: ListQueryHook<TParams, TRow>;
  /** Option lists for `select` filters that already exist on `meta.filters`. */
  filterOptions?: Partial<Record<string, readonly FilterOption[]>>;
  /** Parsed App Router `searchParams` (or Storybook in-memory seed). */
  initialParams?: ListQueryParams;
  /** Page-owned URL adapter. Omit in Storybook. */
  onParamsChange?: (params: ListQueryParams) => void;
  /** Set whenever more than one Root renders on a page so form-control ids stay unique. */
  idPrefix?: string;
  /** When set, the link column renders as an anchor to this href (keyboard-accessible navigation). */
  getRowHref?: (row: TRow) => string | undefined;
  /** Column `field` that receives `getRowHref` links; defaults to the first column. */
  linkField?: string;
  /** Optional wrapper for link cells (e.g. Next.js `Link`). Defaults to `<a href>`. */
  renderRowLink?: (props: { href: string; children: ReactNode }) => ReactNode;
  /** Trailing actions column (edit, unlink, etc.). */
  rowActions?: (row: TRow) => ReactNode;
  children: ReactNode;
};

type DataTableContextValue = ReturnType<typeof useDataTable> & {
  filterOptions?: DataTableRootProps["filterOptions"];
  /** Per-Root prefix so two tables do not share form-control IDs. */
  idBase: string;
  getRowHref?: (row: Record<string, unknown>) => string | undefined;
  linkField?: string;
  renderRowLink?: (props: { href: string; children: ReactNode }) => ReactNode;
  rowActions?: (row: Record<string, unknown>) => ReactNode;
};

const DataTableContext = createContext<DataTableContextValue | null>(null);
const DataTableToolbarContext = createContext(false);

function useDataTableContext(): DataTableContextValue {
  const value = useContext(DataTableContext);
  if (!value) {
    throw new Error("DataTable slots must render inside DataTable.Root");
  }
  return value;
}

const MONEY_MINOR_FIELDS = new Set(["masterPackPrice"]);

function cellValue(row: Record<string, unknown>, field: string): ReactNode {
  const raw = readFieldValue(row, field);
  if (MONEY_MINOR_FIELDS.has(field) && typeof raw === "number") {
    const currency = typeof row.currency === "string" ? row.currency : "USD";
    return (
      <span className="tabular-nums">{formatMoneyMinorUnits(raw, currency)}</span>
    );
  }
  const value = formatFieldDisplay(raw);
  if (value === null || value === undefined) {
    return "—";
  }
  if (typeof value === "number") {
    return <span className="tabular-nums">{value}</span>;
  }
  return String(value);
}

function renderCell(
  row: Record<string, unknown>,
  field: string,
  href: string | undefined,
  renderRowLink?: (props: { href: string; children: ReactNode }) => ReactNode,
): ReactNode {
  const content = cellValue(row, field);
  if (!href) {
    return content;
  }
  const linkClassName = "text-link hover:text-link-hover";
  if (renderRowLink) {
    return renderRowLink({ href, children: content });
  }
  return (
    <a href={href} className={linkClassName}>
      {content}
    </a>
  );
}

function FilterControl({
  filter,
  state,
  setState,
  options,
  idBase,
}: {
  filter: TableFilterMeta;
  state: DataTableState;
  setState: Dispatch<SetStateAction<DataTableState>>;
  options: readonly FilterOption[] | undefined;
  idBase: string;
}) {
  const setFilter = (param: string, value: string | boolean | undefined) => {
    setState((current) => ({
      ...current,
      page: 1,
      filters: { ...current.filters, [param]: value },
    }));
  };
  const filterId = `${idBase}-filter-${filter.param}`;

  if (filter.control === "select") {
    return (
      <div className="flex min-w-40 flex-col gap-2">
        <Label htmlFor={filterId}>{filter.param}</Label>
        <select
          id={filterId}
          className="flex min-h-(--space-input-height) w-full rounded-interactable border border-border-field bg-surface-card px-input-x py-input-y text-input text-fg"
          value={String(state.filters[filter.param] ?? "")}
          onChange={(event) =>
            setFilter(filter.param, event.target.value || undefined)
          }
        >
          <option value="">All</option>
          {(options ?? []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (filter.control === "boolean") {
    return (
      <div className="flex shrink-0 items-center gap-2">
        <Checkbox
          id={filterId}
          density="compact"
          checked={state.filters[filter.param] === true}
          onChange={(checked) =>
            setFilter(filter.param, checked ? true : undefined)
          }
        />
        <Label htmlFor={filterId}>{filter.param}</Label>
      </div>
    );
  }

  if (filter.control === "dateRange") {
    const toParam = filter.rangePair;
    return (
      <div className="flex flex-wrap gap-4">
        <div className="flex min-w-40 flex-col gap-2">
          <Label htmlFor={filterId}>{filter.param}</Label>
          <Input
            id={filterId}
            type="date"
            value={String(state.filters[filter.param] ?? "")}
            onChange={(event) =>
              setFilter(filter.param, event.target.value || undefined)
            }
          />
        </div>
        {toParam ? (
          <div className="flex min-w-40 flex-col gap-2">
            <Label htmlFor={`${idBase}-filter-${toParam}`}>{toParam}</Label>
            <Input
              id={`${idBase}-filter-${toParam}`}
              type="date"
              value={String(state.filters[toParam] ?? "")}
              onChange={(event) =>
                setFilter(toParam, event.target.value || undefined)
              }
            />
          </div>
        ) : null}
      </div>
    );
  }

  const inputType = filter.control === "date" ? "date" : "text";
  return (
    <div className="flex min-w-40 flex-col gap-2">
      <Label htmlFor={filterId}>{filter.param}</Label>
      <Input
        id={filterId}
        type={inputType}
        value={String(state.filters[filter.param] ?? "")}
        onChange={(event) =>
          setFilter(filter.param, event.target.value || undefined)
        }
      />
    </div>
  );
}

/**
 * Per-instance DataTable context: chrome state, injected Orval hook, and slots.
 *
 * When to use: staff list pages. Compose `Search`, `Filters`, `Table`, and
 * `Pagination` as children. Two Roots never share state.
 *
 * When not to use: wholesale catalog, multiple tables on one route (v1 keys
 * are unprefixed), or inside `packages/ui-internal` with Next navigation.
 *
 * Import from `@dc-inventory/ui-internal`.
 *
 * @example
 * ```tsx
 * import { DataTable } from "@dc-inventory/ui-internal";
 * import { useListInternalProducts } from "@dc-inventory/api-client-internal";
 *
 * <DataTable.Root
 *   meta={productsListTable}
 *   queryHook={useListInternalProducts}
 *   filterOptions={{ status: productStatusFilterOptions }}
 *   initialParams={initialParams}
 *   onParamsChange={onParamsChange}
 * >
 *   <DataTable.Search />
 *   <DataTable.Filters />
 *   <DataTable.Table />
 *   <DataTable.Pagination />
 * </DataTable.Root>
 * ```
 */
export function DataTableRoot<
  TParams = ListQueryParams,
  TRow = Record<string, unknown>,
>({
  meta,
  queryHook,
  filterOptions,
  initialParams,
  onParamsChange,
  idPrefix,
  getRowHref,
  linkField,
  renderRowLink,
  rowActions,
  children,
}: DataTableRootProps<TParams, TRow>) {
  const idBase = tableControlIdBase(meta, idPrefix);
  const table = useDataTable({
    meta,
    queryHook,
    initialParams,
    onParamsChange,
  });

  return (
    <DataTableContext.Provider
      value={{
        ...table,
        filterOptions,
        idBase,
        getRowHref: getRowHref as
          | ((row: Record<string, unknown>) => string | undefined)
          | undefined,
        linkField,
        renderRowLink,
        rowActions: rowActions as
          | ((row: Record<string, unknown>) => ReactNode)
          | undefined,
      }}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-field-group">{children}</div>
    </DataTableContext.Provider>
  );
}

/**
 * Search field from `meta.search`.
 *
 * When to use: list pages that declare `x-table.search`.
 * When not to use: outside `DataTable.Root`, or when the operation has no search.
 *
 * Import from `@dc-inventory/ui-internal`.
 *
 * @example
 * ```tsx
 * <DataTable.Root meta={productsListTable} queryHook={useListInternalProducts}>
 *   <DataTable.Search />
 * </DataTable.Root>
 * ```
 */
export function DataTableSearch() {
  const { meta, state, setState, idBase } = useDataTableContext();
  const inToolbar = useContext(DataTableToolbarContext);
  if (!meta.search) {
    return null;
  }
  const searchId = `${idBase}-search`;

  return (
    <TextInput
      id={searchId}
      density="compact"
      className={inToolbar ? "min-w-56 flex-1" : "min-w-56"}
      aria-label={meta.search.placeholder}
      value={state.search}
      placeholder={meta.search.placeholder}
      onChange={(search) =>
        setState((current) => ({
          ...current,
          page: 1,
          search,
        }))
      }
    />
  );
}

/**
 * One compact row for list actions, search, and filters.
 *
 * When to use: staff lists that share a line with Download / Import.
 * When not to use: wrapping the table body.
 */
export function DataTableToolbar({ children }: { children: ReactNode }) {
  return (
    <DataTableToolbarContext.Provider value={true}>
      <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-field-group">
        {children}
      </div>
    </DataTableToolbarContext.Provider>
  );
}

/**
 * Declared `x-table` filters.
 *
 * When to use: catalog-style lists that need status (or other declared) filters.
 * When not to use: inventing filters that are not on `meta.filters`.
 *
 * Import from `@dc-inventory/ui-internal`.
 *
 * @example
 * ```tsx
 * <DataTable.Root
 *   meta={productsListTable}
 *   queryHook={useListInternalProducts}
 *   filterOptions={{ status: productStatusFilterOptions }}
 * >
 *   <DataTable.Filters />
 * </DataTable.Root>
 * ```
 */
export function DataTableFilters() {
  const { meta, state, setState, filterOptions, idBase } = useDataTableContext();
  if (!meta.filters || meta.filters.length === 0) {
    return null;
  }

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-field-group">
      {meta.filters.map((filter) => (
        <FilterControl
          key={filter.param}
          filter={filter}
          state={state}
          setState={setState}
          options={filterOptions?.[filter.param]}
          idBase={idBase}
        />
      ))}
    </div>
  );
}

/**
 * Row grid for the current `queryHook` page.
 *
 * When to use: as the body slot under `DataTable.Root`.
 * When not to use: wholesale product cards, or as a standalone HTML table.
 *
 * Import from `@dc-inventory/ui-internal`.
 *
 * @example
 * ```tsx
 * <DataTable.Root meta={productsListTable} queryHook={useListInternalProducts}>
 *   <DataTable.Table />
 * </DataTable.Root>
 * ```
 */
const FILL_COLUMN_PREFERENCE = ["name", "supplierName", "productName"] as const;
const NUMERIC_FIELDS = new Set([
  "masterPackPrice",
  "onHand",
  "onOrder",
  "allocated",
  "available",
  "qty",
  "caseQty",
]);
const CODE_FIELDS = new Set(["sku", "vendorNumber", "documentNumber"]);

/** Ledger qty headers — same words as ADR 0008 / architecture stock cycle. */
const INVENTORY_CYCLE_HEADER_HELP: Record<string, TableTooltip> = {
  onHand: {
    title: "On hand",
    description:
      "Units physically in the warehouse. Receipts raise this; shipments lower it.",
  },
  onOrder: {
    title: "On order",
    description:
      "Units inbound on open factory purchase orders. Not on the floor yet.",
  },
  allocated: {
    title: "Allocated",
    description:
      "Warehouse cover for confirmed sales. Held against on-hand so those orders can ship. Never exceeds on-hand.",
  },
  available: {
    title: "Available",
    description:
      "Warehouse leftover: on hand minus allocated. What can still be picked from the floor. Not available to sell — that figure also counts inbound and pre-sold demand.",
  },
};

function fillColumnId(meta: TableMeta): string {
  const fields = meta.columns.map((column) => column.field);
  for (const preferred of FILL_COLUMN_PREFERENCE) {
    if (fields.includes(preferred)) {
      return preferred;
    }
  }
  return fields[0] ?? meta.rowId;
}

function columnWidth(field: string): number | undefined {
  if (FILL_COLUMN_PREFERENCE.includes(field as (typeof FILL_COLUMN_PREFERENCE)[number])) {
    return undefined;
  }
  if (CODE_FIELDS.has(field)) {
    return 160;
  }
  if (field === "createdAt") {
    return 180;
  }
  if (field in INVENTORY_CYCLE_HEADER_HELP) {
    return 128;
  }
  if (NUMERIC_FIELDS.has(field)) {
    return 100;
  }
  return 120;
}

export function DataTableTable() {
  const {
    meta,
    items,
    query,
    busy,
    state,
    setState,
    total,
    page,
    pageSize,
    pageCount,
    getRowHref,
    linkField,
    renderRowLink,
    rowActions,
  } = useDataTableContext();
  const resolvedLinkField = linkField ?? meta.columns[0]?.field;
  const fillColumn = fillColumnId(meta);

  const columns = useMemo<TableColumnDef<Record<string, unknown>>[]>(
    () =>
      meta.columns.map((column) => {
        const canSort = meta.sort?.fields.includes(column.field) ?? false;
        return {
          id: column.field,
          label: column.label,
          tooltip: INVENTORY_CYCLE_HEADER_HELP[column.field],
          sort: canSort ? column.field : false,
          width: columnWidth(column.field),
          truncate: column.field !== fillColumn,
          align: NUMERIC_FIELDS.has(column.field) ? "right" : "left",
          render: ({ record }: { record: Record<string, unknown> }) => {
            const href = getRowHref?.(record);
            const content = renderCell(
              record,
              column.field,
              href && column.field === resolvedLinkField ? href : undefined,
              renderRowLink,
            );
            if (CODE_FIELDS.has(column.field)) {
              return <span className="font-mono text-body-sm">{content}</span>;
            }
            return content;
          },
        };
      }),
    [fillColumn, getRowHref, meta.columns, meta.sort, renderRowLink, resolvedLinkField],
  );

  const table = useTable({
    data: items as Record<string, unknown>[],
    isPending: busy,
    isError: query.isError === true,
    columns,
    getRowId: (row) => String(row[meta.rowId] ?? ""),
    fillColumn,
    enableSorting: Boolean(meta.sort),
    enableSelection: false,
    enablePagination: true,
    defaultSortField: meta.sort?.defaultBy ?? null,
    sort: {
      field: state.sortBy || null,
      direction: state.sortOrder,
    },
    onSortChange: (next) => {
      setState((current) => ({
        ...current,
        page: 1,
        sortBy: next.field ?? meta.sort?.defaultBy ?? current.sortBy,
        sortOrder: next.direction,
      }));
    },
    pagination: {
      page: Math.max(0, page - 1),
      pageSize,
      totalRows: total,
      canPreviousPage: page > 1,
      canNextPage: page < pageCount,
    },
    onPaginationChange: (action) => {
      setState((current) => {
        if (action.type === "next") {
          return { ...current, page: current.page + 1 };
        }
        if (action.type === "previous") {
          return { ...current, page: Math.max(1, current.page - 1) };
        }
        return { ...current, page: 1, pageSize: action.pageSize };
      });
    },
    rowActions,
  });

  return (
    <Table
      sticky
      className="min-h-0 flex-1"
      table={table}
      emptyMessage="No rows"
    >
      <Table.Header />
      <Table.Body />
      <Table.Empty />
      <Table.Pagination />
    </Table>
  );
}

/**
 * Previous/next pager bound to Root list state.
 *
 * When to use: under `DataTable.Table` on staff lists.
 * When not to use: as a generic pager outside Root (it reads table context).
 *
 * Import from `@dc-inventory/ui-internal`.
 *
 * @example
 * ```tsx
 * <DataTable.Root meta={productsListTable} queryHook={useListInternalProducts}>
 *   <DataTable.Pagination />
 * </DataTable.Root>
 * ```
 */
export function DataTablePagination() {
  return null;
}

/**
 * Compound staff DataTable. `Root` is the per-instance context; compose slots.
 *
 * When to use: internal dashboard list pages with `x-table` + an Orval hook.
 * When not to use: wholesale shop, ops, or a second table on the same route.
 *
 * Import from `@dc-inventory/ui-internal`.
 *
 * @example
 * ```tsx
 * import { DataTable } from "@dc-inventory/ui-internal";
 * import { useListInternalProducts } from "@dc-inventory/api-client-internal";
 *
 * <DataTable.Root
 *   meta={productsListTable}
 *   queryHook={useListInternalProducts}
 *   initialParams={initialParams}
 *   onParamsChange={onParamsChange}
 * >
 *   <DataTable.Search />
 *   <DataTable.Filters />
 *   <DataTable.Table />
 *   <DataTable.Pagination />
 * </DataTable.Root>
 * ```
 */
export const DataTable = {
  Root: DataTableRoot,
  Toolbar: DataTableToolbar,
  Search: DataTableSearch,
  Filters: DataTableFilters,
  Table: DataTableTable,
  Pagination: DataTablePagination,
};
