import { type ReactNode, useEffect, useState } from 'react'
import type { LiveTableState } from '#shared/resource/types'

// ---------------------------------------------------------------------------
// CellTrigger — discriminated union: in-place click vs navigation link
// ---------------------------------------------------------------------------

interface CellTriggerBase {
  icon: ReactNode
  tooltip?: string
}

interface CellTriggerClick<T> extends CellTriggerBase {
  onClick: (props: { value: unknown; row: T }) => void
  href?: never
}

interface CellTriggerLink<T> extends CellTriggerBase {
  href: (props: { value: unknown; row: T }) => string
  onClick?: never
}

/**
 * Hover-reveal cell-level interaction. Generic on what fires — could open a
 * drilldown modal, add a filter to the current page, copy a value to the
 * clipboard, navigate to another route, etc. Distinct from `Action<T>`
 * (resource-level actions with confirm/active/disabled/handler/ctx
 * lifecycle); a CellTrigger is a per-cell click target with no lifecycle.
 *
 * - `onClick` variant: whole `<td>` becomes a click target. Use for in-place
 *   handlers (open a modal, add a filter, toggle a value, copy text).
 * - `href` variant: cell content wraps in a `<Link>`. Use for navigation —
 *   preserves keyboard focus, cmd/middle-click-to-new-tab, right-click menus,
 *   and Next.js prefetch.
 *
 * Provide exactly one. Discriminated union prevents ambiguity.
 */
export type CellTrigger<T> = CellTriggerClick<T> | CellTriggerLink<T>

// ---------------------------------------------------------------------------
// TableColumnDef — the generic column shape `useTable` consumes directly
// ---------------------------------------------------------------------------

export interface TableTooltip {
  title?: string
  description: string
}

/**
 * Generic column definition. Pure data — no resource-system knowledge.
 * Resource-aware callers (ResourceTable) build these from a `FieldConfig` dict.
 */
export interface TableColumnDef<T> {
  /** Stable identifier — used for sort state and React keys. Dotted ids supported. */
  id: string
  /** Header label. */
  label: string
  /** Optional tooltip in the header. */
  tooltip?: TableTooltip
  /** Custom cell renderer. If absent, the resolved value is stringified. */
  render?: (ctx: { value: unknown; record: T }) => ReactNode | null
  /**
   * Read the cell value from a row. If absent, dotted-path lookup on `id`
   * is used (`row['account.name']` is split → `row.account.name`).
   */
  accessor?: (row: T) => unknown
  /** `false` = unsortable. String = API sort key (may differ from `id`). */
  sort: false | string
  /** Fixed column width. Number = px; string = any CSS width. Mutually exclusive with `flex`. */
  width?: string | number
  /** Flex weight relative to other flex columns. Default 1 when neither `width` nor `flex` is set. */
  flex?: number
  /** Minimum width in px (applies to flex columns). */
  minWidth?: number
  /** Maximum width in px (applies to flex columns). */
  maxWidth?: number
  /** Horizontal alignment of cells + header. Defaults to `'left'`. */
  align?: 'left' | 'center' | 'right'
  /**
   * Per-column cell overflow. Overrides the table-wide `truncate` setting.
   * `true` clips with an ellipsis on one line; `false` wraps. Omit to inherit
   * the table-wide default.
   */
  truncate?: boolean
  cellTrigger?: CellTrigger<T>
  /**
   * When true, the column header shows a persistent "filter applied"
   * indicator beside its label — a column-level signal that a filter
   * targets this column. ResourceTable sets this for cross-filter columns
   * whose field is in the active-filter set.
   */
  filterApplied?: boolean
  /**
   * When true, the cell `<td>` gets the marker.io PII mask class. Headers
   * are never masked — column labels are not PII.
   */
  pii?: boolean
}

/**
 * The API sort key a column drives — the `field` that flows into sort state, the
 * URL, and the query `order`. It is NOT always the column id: `sort: '<key>'`
 * redirects sorting to a different field (e.g. the incidents "Incident" column,
 * id `id`, sorts by `created_at`). Returns `null` for an unsortable column
 * (`sort: false`), so callers can gate on it. All sort machinery — the header's
 * active-sort indicator, the toggle, and the client-side comparator lookup — must
 * key off this, not `column.id`, or a redirected column never sorts.
 */
export function columnSortKey<T>(column: TableColumnDef<T>): string | null {
  if (column.sort === false) return null
  return typeof column.sort === 'string' ? column.sort : column.id
}

// ---------------------------------------------------------------------------
// TableInstance — return shape of `useTable`, consumed by `<Table>`
// ---------------------------------------------------------------------------

export interface TableInstance<T> {
  columns: TableColumnDef<T>[]
  rows: T[]
  totalRows: number
  /**
   * No cached data yet — the loading state owned by the table. `<Table.Body>`
   * shows a spinner row, `<Table.Empty>` is suppressed (so "No results"
   * doesn't flash before data arrives).
   */
  isPending: boolean
  /**
   * The backing query failed. With zero rows, `<Table.Empty>` renders an
   * error card in place of the empty message; `<Table.Pagination>` hides.
   */
  isError: boolean
  /**
   * A fetch is in flight. The error card's "Try again" button renders its
   * loading state while true, so a retry visibly does something.
   */
  isFetching: boolean
  /** Retry callback for the error card, or `null` when none was provided. */
  onRetry: (() => void) | null
  /**
   * Column id whose width absorbs the table's remaining space. Every other
   * column is treated as fixed-width — `<Table>` measures the container and
   * gives this column every pixel not claimed by them.
   */
  fillColumn: string
  /**
   * Cell overflow behavior. `false` (default) lets long content wrap inside
   * the cell. `true` clips with an ellipsis on a single line.
   */
  truncate: boolean
  getRowId: (row: T) => string
  getRowClassName: ((row: T) => string | undefined) | null
  getCellValue: (row: T, column: TableColumnDef<T>) => unknown
  sort: {
    field: string | null
    direction: 'asc' | 'desc'
    toggle: (columnId: string) => void
  }
  selection: {
    selectedIds: ReadonlySet<string>
    count: number
    isSelected: (id: string) => boolean
    toggle: (id: string) => void
    toggleAll: () => void
    clear: () => void
    isAllSelected: boolean
    isIndeterminate: boolean
  }
  pagination: {
    /** Offset-mode page index (0-based). Always 0 in cursor-controlled mode. */
    page: number
    pageSize: number
    /** Total page count. 1 in cursor-controlled mode (unknown). */
    totalPages: number
    /** Total row count. May be -1 in cursor-controlled mode if backend doesn't return it. */
    totalItems: number
    canPreviousPage: boolean
    canNextPage: boolean
    pageSizeOptions: number[]
    /** Advance one page. Works in both offset and cursor modes — Pagination chrome calls this. */
    next: () => void
    previous: () => void
    /** Offset-mode-only direct page set. No-op in cursor-controlled mode. */
    setPage: (page: number) => void
    setPageSize: (size: number) => void
  }
  rowActions: ((row: T) => ReactNode) | null
  enableSorting: boolean
  enableSelection: boolean
  enablePagination: boolean
  /** `null` when the table isn't live. */
  live: TableLiveState | null
}

/**
 * The minimum `<Table.LiveNotice>` needs. Buffering and diffing live upstream
 * in `useLiveRows`; the table only learns how many are waiting.
 */
/** One definition, shared with `useLiveRows`. Pass its `tableLive`. */
export type TableLiveState = LiveTableState

const defaultPageSizeOptions = [25, 50, 100]

// ---------------------------------------------------------------------------
// Default dotted-path accessor
// ---------------------------------------------------------------------------

function dottedAccessor<T>(row: T, path: string): unknown {
  if (row == null) return undefined
  // v3 cube rows are flat with dotted keys (`{ 'group.organization.name': … }`),
  // so prefer a direct lookup. Falls back to nested traversal for REST/nested
  // records (and v2-shaped data) where the dotted path walks objects.
  if (typeof row === 'object' && path in (row as Record<string, unknown>)) {
    return (row as Record<string, unknown>)[path]
  }
  const parts = path.split('.')
  let cur: unknown = row
  for (const part of parts) {
    if (cur == null) return undefined
    if (typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[part]
  }
  return cur
}

// ---------------------------------------------------------------------------
// useSort
// ---------------------------------------------------------------------------

export interface UseSortReturn {
  field: string | null
  direction: 'asc' | 'desc'
  toggle: (columnId: string) => void
}

export function useSort(
  initialField?: string | null,
  initialDirection?: 'asc' | 'desc',
): UseSortReturn {
  const [field, setField] = useState<string | null>(initialField ?? null)
  const [direction, setDirection] = useState<'asc' | 'desc'>(initialDirection ?? 'asc')

  function toggle(columnId: string) {
    if (field === columnId) {
      if (direction === 'asc') {
        setDirection('desc')
      } else {
        setField(null)
        setDirection('asc')
      }
    } else {
      setField(columnId)
      setDirection('asc')
    }
  }

  return { field, direction, toggle }
}

// ---------------------------------------------------------------------------
// useSelection
// ---------------------------------------------------------------------------

export interface UseSelectionReturn {
  selectedIds: ReadonlySet<string>
  count: number
  isSelected: (id: string) => boolean
  toggle: (id: string) => void
  selectAll: (ids: string[]) => void
  clear: () => void
}

export function useSelection(): UseSelectionReturn {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  function isSelected(id: string) {
    return selectedIds.has(id)
  }

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAll(ids: string[]) {
    setSelectedIds(new Set(ids))
  }

  function clear() {
    setSelectedIds(new Set())
  }

  return { selectedIds, count: selectedIds.size, isSelected, toggle, selectAll, clear }
}

// ---------------------------------------------------------------------------
// usePagination
// ---------------------------------------------------------------------------

export interface UsePaginationOptions {
  totalItems: number
  initialPage?: number
  initialPageSize?: number
  pageSizeOptions?: number[]
}

export interface UsePaginationReturn {
  page: number
  pageSize: number
  totalPages: number
  totalItems: number
  canPreviousPage: boolean
  canNextPage: boolean
  pageSizeOptions: number[]
  setPage: (page: number) => void
  setPageSize: (size: number) => void
}

export function usePagination(options: UsePaginationOptions): UsePaginationReturn {
  const {
    totalItems,
    initialPage = 0,
    initialPageSize = 25,
    pageSizeOptions = defaultPageSizeOptions,
  } = options

  const [page, setPageState] = useState(initialPage)
  const [pageSize, setPageSizeState] = useState(initialPageSize)

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const effectivePage = Math.min(Math.max(0, page), totalPages - 1)

  function setPage(p: number) {
    setPageState(Math.max(0, p))
  }

  function setPageSize(size: number) {
    setPageSizeState(size)
    setPageState(0)
  }

  return {
    page: effectivePage,
    pageSize,
    totalPages,
    totalItems,
    canPreviousPage: effectivePage > 0,
    canNextPage: effectivePage < totalPages - 1,
    pageSizeOptions,
    setPage,
    setPageSize,
  }
}

// ---------------------------------------------------------------------------
// useTable
// ---------------------------------------------------------------------------

export interface SortState {
  field: string | null
  direction: 'asc' | 'desc'
}

export interface ControlledPagination {
  pageSize: number
  /** Total row count. -1 if the backend doesn't compute it (cursor-only). */
  totalRows: number
  canPreviousPage: boolean
  canNextPage: boolean
}

export type PaginationAction =
  | { type: 'next' }
  | { type: 'previous' }
  | { type: 'pageSize'; pageSize: number }

export interface UseTableOptions<T> {
  data: T[]
  /**
   * No cached data yet — typically `query.isPending` from a list hook.
   * The Table primitive renders a loading row while true and skips the
   * empty state so "No results" doesn't flash pre-load.
   */
  isPending?: boolean
  /**
   * The backing query failed — typically `isError` from a list hook. When
   * true and there are no rows to show, `<Table.Empty>` renders an error
   * card instead of the empty message, so a failed load never reads as
   * "No results." Rows already fetched keep rendering (stale beats blank).
   */
  isError?: boolean
  /**
   * A fetch is in flight — typically `isFetching` from a list hook. While
   * the error card is showing, this puts its "Try again" button into a
   * loading state so a slow retry doesn't read as a dead button (TanStack
   * keeps `isError: true` until the refetch resolves).
   */
  isFetching?: boolean
  /**
   * Re-runs the backing query — the error card's "Try again" button.
   * Typically `refetch` from the list hook. Omit to render the card
   * without a retry affordance.
   */
  onRetry?: () => void
  columns: TableColumnDef<T>[]
  getRowId: (row: T) => string
  /** Extra classes on the data row, e.g. a warning highlight. */
  getRowClassName?: (row: T) => string | undefined
  /** Render a trailing actions cell per row. */
  rowActions?: (row: T) => ReactNode
  enableSorting?: boolean
  enableSelection?: boolean
  enablePagination?: boolean
  /** From `useLiveRows.tableLive`; omit for a static table. */
  live?: TableLiveState
  /**
   * Column id whose width absorbs the table's remaining space. Required —
   * `<Table>` measures the container and gives this column every pixel not
   * claimed by a fixed-width column. Other columns must declare a `width`
   * (or fall through to their inferred default).
   */
  fillColumn: string
  /**
   * Cell overflow behavior. `false` (default) lets long content wrap inside
   * the cell. `true` clips with an ellipsis on a single line — useful when
   * column widths are tight and uniform row height matters more than
   * preserving the full value.
   */
  truncate?: boolean
  /**
   * Server-reported total row count. When set, pagination math (the
   * `x–z of total` readout, `totalPages`, `canNextPage`) uses it instead of
   * `data.length` — for lists whose backing hook fetches a window of a
   * larger server-side set (e.g. `useCubeExplorerList`). Client-side slicing
   * still applies; the backing hook is responsible for growing `data` to
   * cover the current page. Setting this also declares the server owns the
   * ordering: the client-side sort is skipped, since re-sorting an
   * accumulated window with a comparator that disagrees with server
   * collation (nulls, case) would reshuffle earlier pages as windows
   * arrive. Omit for fully-client-side lists.
   */
  totalRows?: number

  // ---- Controlled state (each axis independently) ----------------------
  // Provide BOTH the value and the change handler to lift state out of
  // useTable. When state is controlled, useTable does not sort/slice/own
  // that axis — the parent is responsible for feeding pre-sorted /
  // pre-paginated data and translating action requests into next state.
  // ----------------------------------------------------------------------

  /** Controlled sort state. Pair with `onSortChange`. */
  sort?: SortState
  onSortChange?: (next: SortState) => void

  /**
   * Default sort field when sort is URL-synced. When set, toggling this column
   * cycles asc ↔ desc instead of asc → desc → cleared — the "cleared" state
   * would round-trip through the URL back to this same default, producing a
   * dead click. Other columns still cycle through cleared (which reverts to
   * the default).
   */
  defaultSortField?: string | null

  /** Controlled pagination state. Pair with `onPaginationChange`. */
  pagination?: ControlledPagination
  onPaginationChange?: (action: PaginationAction) => void

  /**
   * Controlled page index (0-indexed). Use when the page index is owned
   * elsewhere — e.g. URL-synced via `useUrlTableState` — but the data is
   * still client-paginated. Distinct from the full `pagination` controlled
   * mode (which means the parent fed pre-sliced rows). Pair with
   * `onPageChange`. May be combined freely with controlled `pageSize`.
   */
  page?: number
  onPageChange?: (next: number) => void

  /**
   * Controlled page size. Same model as controlled `page` — useTable still
   * slices client-side, the parent owns the value. Pair with
   * `onPageSizeChange`.
   */
  pageSize?: number
  onPageSizeChange?: (next: number) => void

  /** Controlled selection. Pair with `onSelectionChange`. */
  selection?: ReadonlySet<string>
  onSelectionChange?: (next: ReadonlySet<string>) => void

  // ---- Uncontrolled fallbacks (used only when above are absent) --------

  initialSort?: SortState
  initialPage?: number
  initialPageSize?: number
  pageSizeOptions?: number[]
}

/**
 * Generic table state hook. Knows nothing about the resource system.
 *
 * Each of sort, pagination, and selection can be **controlled** (parent owns
 * the state via `sort`/`pagination`/`selection` props + their `onXChange`
 * callbacks) or **uncontrolled** (useTable manages internally — current
 * default). Mix freely: e.g. controlled pagination from a server-paginated
 * list hook + uncontrolled selection.
 *
 * For resource-bound rendering with cube-shaped columns from a `FieldConfig`
 * dict, use `useResourceTable` from `#ds/resource/ResourceTable`.
 */
export function useTable<T>(options: UseTableOptions<T>): TableInstance<T> {
  const {
    data,
    isPending = false,
    isError = false,
    isFetching = false,
    onRetry,
    columns,
    getRowId,
    getRowClassName,
    rowActions,
    enableSorting: sortingEnabled = true,
    enableSelection: selectionEnabled = false,
    enablePagination: paginationEnabled = true,
    live,
    sort: controlledSort,
    onSortChange,
    defaultSortField,
    pagination: controlledPagination,
    onPaginationChange,
    page: controlledPage,
    onPageChange,
    pageSize: controlledPageSize,
    onPageSizeChange,
    selection: controlledSelection,
    onSelectionChange,
    initialSort,
    initialPage,
    initialPageSize,
    pageSizeOptions,
    fillColumn,
    truncate = false,
    totalRows: serverTotalRows,
  } = options

  const isControlledSort = controlledSort !== undefined
  const isControlledPagination = controlledPagination !== undefined
  const isControlledPage = !isControlledPagination && controlledPage !== undefined
  const isControlledPageSize = !isControlledPagination && controlledPageSize !== undefined
  const isControlledSelection = controlledSelection !== undefined

  if (process.env.NODE_ENV !== 'production' && initialSort?.field) {
    // Validate against sort KEYS, not column ids — a column may redirect its
    // sort to a different field (`sort: '<key>'`), so `initialSort.field` is a
    // sort key that need not equal any column id.
    const sortKeys = columns.map(columnSortKey).filter((k): k is string => k !== null)
    if (!sortKeys.includes(initialSort.field)) {
      console.warn(
        `useTable: initialSort.field "${initialSort.field}" does not match any column sort key. ` +
          `Available: ${sortKeys.join(', ')}. Sort indicator will not be visible.`,
      )
    }
  }

  // ---- Sort ------------------------------------------------------------

  const internalSort = useSort(initialSort?.field, initialSort?.direction)
  const sortField = isControlledSort ? controlledSort.field : internalSort.field
  const sortDirection = isControlledSort ? controlledSort.direction : internalSort.direction

  function getCellValue(row: T, column: TableColumnDef<T>): unknown {
    return column.accessor ? column.accessor(row) : dottedAccessor(row, column.id)
  }

  // Client-side sort runs unless the server owns the ordering: pagination
  // fully controlled (each page is a pre-sorted, pre-sliced subset), or a
  // server `totalRows` was given (the data is a window of a larger set the
  // server sorted — the client comparator can disagree with server collation
  // on nulls/case, and re-sorting would reshuffle earlier pages as windows
  // accumulate). Controlled `sort` state is a separate axis from pre-sorted
  // data: parents URL-sync sort state without necessarily piping it through
  // to the API.
  let sorted = data
  if (
    !isControlledPagination &&
    serverTotalRows === undefined &&
    // A live table's order belongs to its committed snapshot. Re-sorting here
    // would be a second source of truth: a value change would move the row
    // immediately, which is exactly what the buffer exists to prevent. The
    // producer sorts; `hasPendingChanges` reports when its order has drifted.
    live === undefined &&
    sortingEnabled &&
    sortField !== null
  ) {
    const col = columns.find((c) => columnSortKey(c) === sortField)
    if (col) {
      sorted = [...data].sort((a, b) => {
        const va = getCellValue(a, col)
        const vb = getCellValue(b, col)
        if (va === vb) return 0
        if (va == null) return 1
        if (vb == null) return -1
        const cmp = va < vb ? -1 : 1
        return sortDirection === 'desc' ? -cmp : cmp
      })
    }
  }

  // ---- Pagination ------------------------------------------------------

  const internalPagination = usePagination({
    // Server-reported total (when set) also drives the internal page clamp —
    // otherwise an uncontrolled table could never page past the fetched window.
    totalItems: serverTotalRows ?? sorted.length,
    initialPage,
    initialPageSize,
    pageSizeOptions,
  })

  let rows: T[]
  let totalRows: number
  let pagPageSize: number
  let pagPage: number
  let pagTotalPages: number
  let pagCanPrev: boolean
  let pagCanNext: boolean
  let pagOptions: number[]

  if (isControlledPagination) {
    // Parent fed the current page directly. No client slicing.
    rows = data
    totalRows = controlledPagination.totalRows
    pagPageSize = controlledPagination.pageSize
    pagPage = 0
    pagTotalPages = 1
    pagCanPrev = controlledPagination.canPreviousPage
    pagCanNext = controlledPagination.canNextPage
    pagOptions = pageSizeOptions ?? defaultPageSizeOptions
  } else {
    // page / pageSize may be controlled independently; client-side slicing
    // still applies. The uncontrolled axis falls back to internal state.
    // A server-reported total (when the data is a fetched window of a larger
    // set) overrides the fetched count for the pagination math.
    pagPageSize = isControlledPageSize ? controlledPageSize! : internalPagination.pageSize
    totalRows = serverTotalRows ?? sorted.length
    pagTotalPages = Math.max(1, Math.ceil(totalRows / pagPageSize))
    const requestedPage = isControlledPage ? controlledPage! : internalPagination.page
    pagPage = Math.min(Math.max(0, requestedPage), pagTotalPages - 1)
    pagCanPrev = pagPage > 0
    pagCanNext = pagPage < pagTotalPages - 1
    rows = paginationEnabled
      ? sorted.slice(pagPage * pagPageSize, (pagPage + 1) * pagPageSize)
      : sorted
    pagOptions = pageSizeOptions ?? internalPagination.pageSizeOptions
  }

  function emitPage(next: number) {
    const clamped = Math.max(0, next)
    if (isControlledPage) onPageChange?.(clamped)
    else internalPagination.setPage(clamped)
  }

  function paginationNext() {
    if (isControlledPagination) onPaginationChange?.({ type: 'next' })
    else emitPage(pagPage + 1)
  }
  function paginationPrevious() {
    if (isControlledPagination) onPaginationChange?.({ type: 'previous' })
    else emitPage(pagPage - 1)
  }
  function paginationSetPage(p: number) {
    if (isControlledPagination) return // no-op — controlled cursor mode
    emitPage(p)
  }
  function paginationSetPageSize(size: number) {
    if (isControlledPagination) {
      onPaginationChange?.({ type: 'pageSize', pageSize: size })
      return
    }
    if (isControlledPageSize) {
      // Consumer owns pageSize — and is responsible for resetting page
      // atomically in the same write. Firing a separate `onPageChange(0)`
      // here would race the size update on a stale URL snapshot, e.g.
      // `?page=3` → write `?size=50` → second write off stale params would
      // drop `?size` again. `useUrlTableState.onPageSizeChange` deletes
      // `?page` in the same `router.replace`.
      onPageSizeChange?.(size)
    } else {
      internalPagination.setPageSize(size) // also resets internal page to 0
      if (isControlledPage) onPageChange?.(0)
    }
  }

  // ---- Selection -------------------------------------------------------

  const internalSelection = useSelection()
  const selectedIds = isControlledSelection ? controlledSelection : internalSelection.selectedIds
  const selectionCount = selectedIds.size

  function selectionIsSelected(id: string) {
    return selectedIds.has(id)
  }

  function emitSelection(next: ReadonlySet<string>) {
    if (isControlledSelection) onSelectionChange?.(next)
    else internalSelection.selectAll(Array.from(next))
  }

  // Live tables only: drop selected ids whose rows left, so a bulk-action count
  // can't include records that no longer exist. Static tables keep the
  // deliberate never-prune contract (see `PrincipalsTable`).
  useEffect(() => {
    if (!live || isControlledSelection || internalSelection.selectedIds.size === 0) return
    const present = new Set(data.map(getRowId))
    const survivors = Array.from(internalSelection.selectedIds).filter((id) => present.has(id))
    if (survivors.length !== internalSelection.selectedIds.size) {
      internalSelection.selectAll(survivors)
    }
  }, [live, isControlledSelection, internalSelection, data, getRowId])

  function selectionToggle(id: string) {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    emitSelection(next)
  }

  function selectionClear() {
    emitSelection(new Set())
  }

  const visibleRowIds = rows.map(getRowId)
  const isAllSelected = visibleRowIds.length > 0 && visibleRowIds.every((id) => selectedIds.has(id))
  const isIndeterminate = selectionCount > 0 && !isAllSelected

  function toggleAll() {
    if (isAllSelected) selectionClear()
    else emitSelection(new Set(visibleRowIds))
  }

  // ---- Sort toggle (with pagination reset when uncontrolled) -----------

  function sortToggle(columnId: string) {
    const col = columns.find((c) => c.id === columnId)
    if (!col) return
    // Sort state is keyed by the column's API sort key, which may differ from
    // its id (`sort: '<key>'` redirect). Resolving it here means a redirected
    // column's toggle emits the sort key the query understands — clicking the
    // incidents "Incident" header sorts by `created_at`, not the dead `id`.
    const sortKey = columnSortKey(col)
    if (sortKey === null) return

    // Compute next sort state (asc → desc → cleared cycle). The default
    // sort field skips the cleared step — it would round-trip through the
    // URL back to this same default, producing a dead click.
    let next: SortState
    if (sortField === sortKey) {
      if (sortDirection === 'asc') next = { field: sortKey, direction: 'desc' }
      else if (sortKey === defaultSortField) next = { field: sortKey, direction: 'asc' }
      else next = { field: null, direction: 'asc' } // cleared → revert to default
    } else {
      next = { field: sortKey, direction: 'asc' }
    }

    if (isControlledSort) {
      onSortChange?.(next)
      // Parent should reset pagination on sort change; we don't touch it here.
    } else {
      // Mirror the prior internal cycle via the existing setter — keyed by the
      // same sort key so internal sort state matches the controlled path.
      internalSort.toggle(sortKey)
      if (!isControlledPagination) emitPage(0)
    }
  }

  return {
    columns,
    rows,
    totalRows,
    isPending,
    isError,
    isFetching,
    onRetry: onRetry ?? null,
    fillColumn,
    truncate,
    getRowId,
    getRowClassName: getRowClassName ?? null,
    getCellValue,
    sort: {
      field: sortField,
      direction: sortDirection,
      toggle: sortToggle,
    },
    selection: {
      selectedIds,
      count: selectionCount,
      isSelected: selectionIsSelected,
      toggle: selectionToggle,
      toggleAll,
      clear: selectionClear,
      isAllSelected,
      isIndeterminate,
    },
    pagination: {
      page: pagPage,
      pageSize: pagPageSize,
      totalPages: pagTotalPages,
      totalItems: totalRows,
      canPreviousPage: pagCanPrev,
      canNextPage: pagCanNext,
      pageSizeOptions: pagOptions,
      next: paginationNext,
      previous: paginationPrevious,
      setPage: paginationSetPage,
      setPageSize: paginationSetPageSize,
    },
    rowActions: rowActions ?? null,
    enableSorting: sortingEnabled,
    enableSelection: selectionEnabled,
    enablePagination: paginationEnabled,
    live: live ?? null,
  }
}
