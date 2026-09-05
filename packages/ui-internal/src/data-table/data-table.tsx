"use client";

import {
  Checkbox,
  Input,
  Label,
  ResourceFilterBar,
  Table,
  TextInput,
  useTable,
  type FilterState,
  type FilterValue,
  type TableColumnDef,
  type TableTooltip,
} from "@dc-inventory/ui";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
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
import { formatStockField, readFieldValue } from "./cell-value";
import {
  appliedTableFilterValue,
  isAppliedTableFilter,
  tableFilterFields,
} from "./table-filter-bar";
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
  /** Readable labels for boolean/text filters when `param` is not enough. */
  filterLabels?: Partial<Record<string, string>>;
  /** Default-on boolean filters: checked unless explicitly `false`. */
  filterDefaults?: Partial<Record<string, boolean>>;
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
  /** Trailing actions column. Each `Button` includes a leading icon and a Title Case label. */
  rowActions?: (row: TRow) => ReactNode;
  /** Per-field cell override. Feature owns domain chips and other custom cells. */
  renderColumns?: Partial<Record<string, (row: TRow) => ReactNode>>;
  /** Shown when the list returns zero rows. */
  emptyMessage?: ReactNode;
  children: ReactNode;
};

type DataTableContextValue = ReturnType<typeof useDataTable> & {
  filterOptions?: DataTableRootProps["filterOptions"];
  filterLabels?: DataTableRootProps["filterLabels"];
  filterDefaults?: DataTableRootProps["filterDefaults"];
  emptyMessage?: ReactNode;
  /** Per-Root prefix so two tables do not share form-control IDs. */
  idBase: string;
  getRowHref?: (row: Record<string, unknown>) => string | undefined;
  linkField?: string;
  renderRowLink?: (props: { href: string; children: ReactNode }) => ReactNode;
  rowActions?: (row: Record<string, unknown>) => ReactNode;
  renderColumns?: Partial<
    Record<string, (row: Record<string, unknown>) => ReactNode>
  >;
};

const DataTableContext = createContext<DataTableContextValue | null>(null);
const DataTableToolbarContext = createContext(false);

export function useDataTableContext(): DataTableContextValue {
  const value = useContext(DataTableContext);
  if (!value) {
    throw new Error("DataTable slots must render inside DataTable.Root");
  }
  return value;
}

function cellValue(row: Record<string, unknown>, field: string): ReactNode {
  const value = formatStockField(field, readFieldValue(row, field));
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
  label,
  filterDefaults,
}: {
  filter: TableFilterMeta;
  state: DataTableState;
  setState: Dispatch<SetStateAction<DataTableState>>;
  options: readonly FilterOption[] | undefined;
  idBase: string;
  label: string;
  filterDefaults?: Partial<Record<string, boolean>>;
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
        <Label htmlFor={filterId}>{label}</Label>
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
    const defaultOn = filterDefaults?.[filter.param] === true;
    return (
      <div className="flex shrink-0 items-center gap-2">
        <Checkbox
          id={filterId}
          density="compact"
          checked={
            defaultOn
              ? state.filters[filter.param] !== false
              : state.filters[filter.param] === true
          }
          onChange={(checked) =>
            setFilter(
              filter.param,
              defaultOn ? (checked ? undefined : false) : checked ? true : undefined,
            )
          }
        />
        <Label htmlFor={filterId}>{label}</Label>
      </div>
    );
  }

  if (filter.control === "dateRange") {
    const toParam = filter.rangePair;
    return (
      <div className="flex flex-wrap gap-4">
        <div className="flex min-w-40 flex-col gap-2">
          <Label htmlFor={filterId}>{label}</Label>
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
      <Label htmlFor={filterId}>{label}</Label>
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
  filterLabels,
  filterDefaults,
  initialParams,
  onParamsChange,
  idPrefix,
  getRowHref,
  linkField,
  renderRowLink,
  rowActions,
  renderColumns,
  emptyMessage,
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
        filterLabels,
        filterDefaults,
        idBase,
        getRowHref: getRowHref as
          | ((row: Record<string, unknown>) => string | undefined)
          | undefined,
        linkField,
        renderRowLink,
        rowActions: rowActions as
          | ((row: Record<string, unknown>) => ReactNode)
          | undefined,
        renderColumns: renderColumns as
          | Partial<Record<string, (row: Record<string, unknown>) => ReactNode>>
          | undefined,
        emptyMessage,
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
      className="w-52 shrink-0"
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
  const { meta, state, setState, filterOptions, filterLabels, filterDefaults, idBase } =
    useDataTableContext();
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
          label={filterLabels?.[filter.param] ?? filter.param}
          filterDefaults={filterDefaults}
        />
      ))}
    </div>
  );
}

/**
 * Desktop `ResourceFilterBar` from `x-table` search + filters.
 *
 * When to use: staff list pages that should match the kit explorer chrome.
 * When not to use: inventing filters that are not on `meta.filters`.
 */
export function DataTableFilterBar({ resource }: { resource?: string } = {}) {
  const {
    meta,
    state,
    setState,
    filterOptions,
    filterLabels,
  } = useDataTableContext();
  const [drafts, setDrafts] = useState<string[]>([]);
  const fields = useMemo(
    () => tableFilterFields(meta, filterOptions, filterLabels),
    [meta, filterOptions, filterLabels],
  );
  const setSearch = useCallback(
    (search: string) => {
      setState((current) => ({ ...current, page: 1, search }));
    },
    [setState],
  );
  const onAdd = useCallback((field: string) => {
    setDrafts((current) => (current.includes(field) ? current : [...current, field]));
  }, []);
  const onRemove = useCallback(
    (field: string) => {
      setDrafts((current) => current.filter((key) => key !== field));
      setState((current) => ({
        ...current,
        page: 1,
        filters: { ...current.filters, [field]: undefined },
      }));
    },
    [setState],
  );
  const onUpdate = useCallback(
    (field: string, value: FilterValue) => {
      const appliedValue = appliedTableFilterValue(value);
      setDrafts((current) =>
        appliedValue === undefined
          ? current.includes(field)
            ? current
            : [...current, field]
          : current.filter((key) => key !== field),
      );
      setState((current) => ({
        ...current,
        page: 1,
        filters: { ...current.filters, [field]: appliedValue },
      }));
    },
    [setState],
  );
  const onClear = useCallback(() => {
    setDrafts([]);
    setState((current) => ({
      ...current,
      page: 1,
      search: "",
      filters: {},
    }));
  }, [setState]);

  const filters = useMemo<FilterState>(() => {
    const applied = Object.entries(state.filters)
      .filter(([, value]) => isAppliedTableFilter(value))
      .map(([field, value]) => ({
        field,
        value: value as string | boolean | readonly string[],
      }));
    const appliedKeys = new Set(applied.map((filter) => filter.field));
    const draftChips = drafts
      .filter((field) => field in fields && !appliedKeys.has(field))
      .map((field) => ({ field, value: null }));

    return {
      active: [...applied, ...draftChips],
      search: state.search,
      setSearch,
      onAdd,
      onRemove,
      onUpdate,
      onClear,
    };
  }, [drafts, fields, onAdd, onClear, onRemove, onUpdate, setSearch, state.filters, state.search]);

  return (
    <ResourceFilterBar filters={filters} data-testid="data-table-filter-bar">
      <ResourceFilterBar.Search placeholder={meta.search?.placeholder} />
      <ResourceFilterBar.Chips fields={fields} resource={resource} />
    </ResourceFilterBar>
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
const FILL_COLUMN_PREFERENCE = [
  "name",
  "supplierName",
  "productName",
  "customerName",
] as const;
const NUMERIC_FIELDS = new Set([
  "listPrice",
  "lastPoCostCents",
  "memberPrice",
  "onHand",
  "onOrder",
  "allocated",
  "available",
  "committed",
  "availableToSell",
  "qty",
  "caseQty",
  "remaining",
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
  committed: {
    title: "Committed (pre-sold)",
    description:
      "Confirmed sales not yet shipped or decommitted. The demand side of available to sell. Not warehouse allocated.",
  },
  availableToSell: {
    title: "Available to sell",
    description:
      "What a customer may still buy. Locked SKUs use on hand plus on order minus committed. Open SKUs have no numeric cap (shown as Open).",
  },
  sellState: {
    title: "Sell state",
    description:
      "Open: confirm is not capped by available to sell. Locked: first factory PO (or sell window) closed infinity. Receive does not reopen.",
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
  if (field === "status") {
    return 148;
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
    renderColumns,
    emptyMessage,
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
            const custom = renderColumns?.[column.field];
            if (custom !== undefined) {
              return custom(record);
            }
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
    [
      fillColumn,
      getRowHref,
      meta.columns,
      meta.sort,
      renderColumns,
      renderRowLink,
      resolvedLinkField,
    ],
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
      emptyMessage={emptyMessage ?? "No rows"}
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
  FilterBar: DataTableFilterBar,
  Table: DataTableTable,
  Pagination: DataTablePagination,
};
