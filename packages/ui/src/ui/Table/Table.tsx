// @ts-nocheck — live-row protocol is parked with ResourceTable.
import {
  Children,
  createContext,
  isValidElement,
  use,
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactElement,
  type ReactNode,
} from 'react'
import Link from 'next/link'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsUpDown,
  Filter,
} from 'lucide-react'
import { PII_MASK_CLASS } from '#shared/constants/pii-mask'
import { cn } from '#cn'
import { ErrorState } from '#ds/ui/ErrorState'
import { Skeleton } from '#ds/ui/Skeleton'
import { Tooltip } from '#ds/ui/Tooltip'
import { TooltipHelp } from '#ds/ui/TooltipHelp'
import { columnSortKey, type TableColumnDef, type TableInstance } from './Table.hook'
import {
  isSequentialTableTabField,
  tableCellTabIndex,
  tableRowTabIndex,
} from './table-tab-order'
import './Table.css'

// Reserved widths in px for the optional leading checkbox col + trailing actions col.
const SELECTION_WIDTH = 40
const ACTIONS_WIDTH = 48

// Width applied to a non-fill column that declares neither `width` nor
// `minWidth`. Wide enough to fit a typical short label + sort chevron.
const DEFAULT_COLUMN_WIDTH = 160

// Floor applied to the fill column when its own `minWidth` is not set.
// Lower than `DEFAULT_COLUMN_WIDTH` because the fill column is expected to
// grow; this is only the smallest size it collapses to in a narrow viewport.
const DEFAULT_FILL_MIN_WIDTH = 120

/**
 * Resolve column declarations to concrete pixel widths against a known
 * container width. The named `fillColumn` absorbs all remaining space
 * (clamped to its own `minWidth`, or `DEFAULT_FILL_MIN_WIDTH` when unset).
 * All other columns fall back to their declared `width` / `minWidth` /
 * `DEFAULT_COLUMN_WIDTH`.
 *
 * Returns `null` when measurement is unavailable — caller should fall back
 * to `table-fixed`'s native equal distribution for that frame.
 */
export function computeColumnWidths<T>(
  columns: TableColumnDef<T>[],
  hasSelection: boolean,
  hasActions: boolean,
  containerWidth: number | null,
  fillColumn: string,
): (number | undefined)[] | null {
  if (containerWidth === null || containerWidth <= 0) return null

  const reserved = (hasSelection ? SELECTION_WIDTH : 0) + (hasActions ? ACTIONS_WIDTH : 0)
  const available = Math.max(0, containerWidth - reserved)

  // Fill-column mode: every non-fill column must resolve to a fixed pixel
  // width so we can subtract their total from the available space and
  // hand the remainder to the fill column. Walk the columns once and
  // record each non-fill column's width while summing them.
  let fixedTotal = 0
  const fixedWidths: (number | null)[] = columns.map((c) => {
    // Placeholder for the fill column — its width is computed below once
    // we know what's left over. We keep its index slot so the final
    // returned array stays aligned with `columns`.
    if (c.id === fillColumn) return null
    // Non-fill columns must be fixed. Prefer the declared `width`; fall
    // back to `minWidth` (the field-kind-inferred floor); fall back to a
    // sane default so a column that declared neither still claims a
    // reasonable slice of the row.
    const w = typeof c.width === 'number' ? c.width : (c.minWidth ?? DEFAULT_COLUMN_WIDTH)
    fixedTotal += w
    return w
  })
  // Find the fill column so we can honor its `minWidth` as a floor —
  // without this, a too-narrow container would compute a negative or
  // zero fill width and the column would visually collapse.
  const fillCol = columns.find((c) => c.id === fillColumn)
  const fillMin = fillCol?.minWidth ?? DEFAULT_FILL_MIN_WIDTH
  // Remaining-space allocation: take whatever the fixed columns didn't
  // claim, but never shrink below the fill column's minWidth. When the
  // container is wider than the sum of fixed widths + fillMin, the fill
  // column absorbs the extra; when it's narrower, the fill column stays
  // at fillMin and the row overflows horizontally (the scroll container
  // handles that).
  const fillWidth = Math.max(fillMin, available - fixedTotal)
  // Replace each placeholder slot with the computed fill width; every
  // other slot already holds its fixed pixel value from the first pass.
  return fixedWidths.map((w) => (w === null ? fillWidth : w))
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface TableContextValue {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: TableInstance<any>
  sticky: boolean
  /**
   * Measured width of the inner scroller (null pre-measurement). Lets the
   * empty state pin its message to the visible strip when the columns
   * overflow the scroller horizontally.
   */
  containerWidth: number | null
}

const TableContext = createContext<TableContextValue | null>(null)

function useTableContext() {
  const ctx = use(TableContext)
  if (!ctx) throw new Error('Table sub-components must be used within a <Table>')
  return ctx
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface TableRootProps extends ComponentPropsWithRef<'div'> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: TableInstance<any>
  /**
   * Default empty-state message. Used when no `<Table.Empty>` child is
   * provided. Defaults to `'No results.'`.
   */
  emptyMessage?: ReactNode
  /**
   * When true, the card scrolls its own rows (CORE-990): it caps at the
   * hosting container's content height (`max-h-full` — the cap binds only
   * when the parent chain provides a definite height, as ExplorerView.Content
   * does) and the rows scroll inside it on both axes. The thead pins to the
   * card's internal scroller, the card outline stays visible while content
   * scrolls under it, and the bulk/pagination bars are static chrome below
   * the scroller. The root emits `data-sticky-table` so hosting layouts
   * react via `:has([data-sticky-table])` — DetailView / RouterTabs build a
   * definite-height flex chain (CORE-1009), and the legacy `sticky-scrollport`
   * utility (Dialog.Body) swaps its vertical padding for pseudo-spacers.
   * Defaults to `false`.
   */
  sticky?: boolean
  /**
   * Required. Format: `{feature}-{view}-{element}`.
   * Example: `accounts-explorer-table`.
   * See `.claude/rules/concepts/testid.md` for the full spec.
   */
  'data-testid'?: string
}

export type TableHeaderProps = ComponentPropsWithRef<'thead'>
export type TableBodyProps = ComponentPropsWithRef<'tbody'>
export type TableEmptyProps = ComponentPropsWithRef<'tbody'>
export type TablePaginationProps = ComponentPropsWithRef<'div'>
export type TableBulkActionsProps = ComponentPropsWithRef<'div'>

export type TableLiveNoticeProps = ComponentPropsWithRef<'div'>

// ---------------------------------------------------------------------------
// Slot resolution — find each well-known sub-component in `children`. Anything
// the consumer didn't pass falls back to a default slot, so the call site
// only writes the parts it wants to override.
// ---------------------------------------------------------------------------

function findSlot(children: ReactNode, type: unknown): ReactElement | null {
  let found: ReactElement | null = null
  Children.forEach(children, (child) => {
    if (isValidElement(child) && child.type === type) found = child
  })
  return found
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

/**
 * Table container. Hosts the table's `useTable()` instance via context so
 * sub-components (Header, Body, Empty, Pagination, BulkActions) read sorting,
 * selection, pagination, and column metadata without prop-drilling. Slots
 * have sensible defaults — pass children only to override.
 *
 * @when Wrap an explicit set of slots when you want to customize one — most
 *   usage is just `<Table table={t} />` and the defaults handle Header /
 *   Body / Empty / Pagination.
 * @avoid Forking layouts (custom row markup) here — write a custom column
 *   `render` instead. Reaching past the public slots into private internals.
 * @example
 * const t = useTable({ data, columns, ... })
 * <Table table={t}>
 *   <Table.BulkActions>
 *     <Button onClick={...}>Archive</Button>
 *   </Table.BulkActions>
 * </Table>
 */
export function TableRoot({
  table,
  children,
  className,
  emptyMessage,
  sticky = false,
  ref,
  ...rest
}: TableRootProps) {
  // Measure the inner scroller — the width-bearing element in both modes —
  // so flex columns can resolve to pixel widths. Its contentRect is exactly
  // the box the columns must fill (the scroller has no border or padding of
  // its own). First paint runs before measurement; we fall back to the
  // browser's table-fixed equal-distribution for that frame, then update
  // once measured.
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState<number | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width ?? null
      setContainerWidth(next)
    })
    ro.observe(el)
    return () => {
      ro.disconnect()
    }
  }, [])

  const resolved = computeColumnWidths(
    table.columns,
    table.enableSelection,
    !!table.rowActions,
    containerWidth,
    table.fillColumn,
  )

  // Default chrome: every consumer gets Header + Body + Empty + Pagination
  // unless they pass that slot explicitly. Bulk actions are opt-in (no
  // sensible default for what the buttons should be).
  const headerNode = findSlot(children, TableHeader) ?? <TableHeader />
  const bodyNode = findSlot(children, TableBody) ?? <TableBody />
  const emptyNode = findSlot(children, TableEmpty) ?? (
    <TableEmpty>{emptyMessage ?? 'No results.'}</TableEmpty>
  )
  const paginationNode = findSlot(children, TablePagination) ?? <TablePagination />
  const bulkActionsNode = findSlot(children, TableBulkActions)
  // Not opt-in via children: the component self-suppresses when not live.
  const liveNoticeNode = findSlot(children, TableLiveNotice) ?? <TableLiveNotice />

  const tableEl = (
    <table className="w-full table-fixed text-left text-sm">
      <colgroup>
        {table.enableSelection && <col className="w-10" />}
        {table.columns.map((column, i) => {
          // Resolved (post-measurement) widths win. Pre-measurement,
          // fall back to declared fixed widths or no-width (table-fixed
          // distributes equally).
          const px = resolved?.[i]
          const width: string | undefined =
            px !== undefined
              ? `${px}px`
              : typeof column.width === 'string'
                ? column.width
                : typeof column.width === 'number'
                  ? `${column.width}px`
                  : undefined
          return <col key={column.id} style={width ? { width } : undefined} />
        })}
        {table.rowActions && <col className="w-12" />}
      </colgroup>
      {headerNode}
      {bodyNode}
      {emptyNode}
    </table>
  )

  return (
    <TableContext value={{ table, sticky, containerWidth }}>
      <div
        ref={ref}
        // `data-sticky-table` is the public contract for layout
        // compensation — DetailView / RouterTabs build a definite-height flex
        // chain via `:has([data-sticky-table])` (CORE-1009), and the legacy
        // `sticky-scrollport` utility (Dialog.Body) uses it to swap its
        // vertical padding for pseudo spacers.
        data-sticky-table={sticky || undefined}
        className={cn(
          'flex w-full flex-col rounded-section border border-border',
          // Sticky mode: the card owns its own scrolling (CORE-990). It caps
          // at the hosting container's content height and the rows scroll
          // INSIDE it — the card outline stays put while content disappears
          // under the frame, both scrollbars render at the card's own edges,
          // and the bulk/pagination bars are static card chrome below the
          // scroller (always visible, no sticky machinery). `overflow-clip`
          // (not `overflow-hidden`) clips the chrome to the rounded corners
          // without creating a scrolling ancestor for the thead.
          //
          // `min-h-0` is the height binding when the card is a flex item
          // (detail-tab / reports feature roots). It keeps the DEFAULT flex
          // sizing (grow:0, shrink:1) so the card shrink-wraps its content when
          // rows are few and caps + scrolls only once content exceeds the space
          // left under a sibling filter-bar row — matching ExplorerView, which
          // shrink-wraps too. `min-h-0` (not the fragile `overflow-clip`
          // min-height zeroing) is what lets it shrink below content. NOT
          // `flex-1`: that forces the card to fill all remaining space, leaving
          // dead space below the last row on short tables. Inert in block-flow
          // scrollport parents (ExplorerViewContent, Dialog.Body) where
          // `max-h-full` is the binding — a child is only a flex item when its
          // parent is `display:flex`, and `min-h-0` is a no-op on block boxes.
          sticky && 'max-h-full overflow-clip min-h-0',
          className,
        )}
        {...rest}
      >
        {liveNoticeNode}
        {/* The single scroller: horizontal always; vertical too once the
            sticky height cap binds. The sticky thead pins against the
            nearest scrollport on EITHER axis, so both axes must live on this
            one element. `min-h-0` lets it shrink under the cap instead of
            squashing the chrome bars (which carry `shrink-0`).
            `tabIndex={-1}` + `focus:outline-none`: Firefox puts `overflow:auto`
            regions in the tab order — the grid's roving tabindex owns internal
            focus, so opt the scrollport itself out (accessibility.md). */}
        <div
          ref={(el) => {
            containerRef.current = el
          }}
          tabIndex={-1}
          className={cn('overflow-auto focus:outline-none', sticky && 'min-h-0')}
        >
          {tableEl}
        </div>
        {bulkActionsNode}
        {paginationNode}
      </div>
    </TableContext>
  )
}

/**
 * Table header. Renders sortable column triggers, the optional select-all
 * checkbox, and the row-actions placeholder column. Reads everything from
 * the Table context; no caller-provided props.
 *
 * @when Custom positioning of the header (rare) — most usage relies on
 *   Table's default header slot.
 */
export function TableHeader({ className, ref, ...rest }: TableHeaderProps) {
  const { table, sticky } = useTableContext()

  return (
    <thead
      ref={ref}
      className={cn(
        'border-b border-border',
        // When sticky, the bg must be opaque (not a translucent tint) so
        // rows scrolling behind don't bleed through; `bg-surface-card` is
        // the section-elevation opaque surface. When not sticky, the
        // original `bg-interactive-hover` tint reads correctly against
        // rows since nothing scrolls under it.
        //
        // `-top-px` (not `top-0`) hides the 1px subpixel-rounding seam
        // between the sticky thead and the row scrolling under it; the
        // scrollport's overflow clips the 1px overshoot.
        sticky ? 'sticky -top-px z-sticky-toolbar bg-surface-card' : 'bg-interactive-hover',
        className,
      )}
      {...rest}
    >
      <tr>
        {table.enableSelection && (
          <th className="w-10 section-content-padding">
            <input
              type="checkbox"
              checked={table.selection.isAllSelected}
              ref={(el) => {
                if (el) el.indeterminate = table.selection.isIndeterminate
              }}
              onChange={table.selection.toggleAll}
              aria-label="Select all rows"
            />
          </th>
        )}
        {table.columns.map((column) => {
          const isSortable = table.enableSorting && column.sort !== false
          // Compare against the column's API sort key, not its id — a redirected
          // column (`sort: '<key>'`) is sorted when the active field is that key,
          // so its header shows the active-sort chevron + `aria-sort`. Gated on
          // `isSortable` so an unsortable column (sort key `null`) never reads as
          // sorted when no sort is active (`null === null`).
          const isSorted = isSortable && table.sort.field === columnSortKey(column)
          const hasTooltip = Boolean(column.tooltip)
          const align = column.align ?? 'left'
          // Focusable when sortable (to activate) or when a tooltip exists
          // (so keyboard users can read the description). Either way, the
          // `<th>` itself is the single tab stop — no nested tooltip button.
          const isFocusable = isSortable || hasTooltip

          const th = (
            <th
              key={column.id}
              tabIndex={isFocusable ? 0 : undefined}
              role={isSortable ? 'button' : undefined}
              className={cn(
                'section-content-padding text-body-sm font-medium text-fg-tertiary',
                align === 'right' && 'text-right',
                align === 'center' && 'text-center',
                isSortable && 'cursor-pointer select-none hover:text-fg',
                hasTooltip && !isSortable && 'cursor-help',
              )}
              onClick={isSortable ? () => table.sort.toggle(column.id) : undefined}
              onKeyDown={
                isSortable
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        table.sort.toggle(column.id)
                      }
                    }
                  : undefined
              }
              aria-sort={
                isSorted ? (table.sort.direction === 'asc' ? 'ascending' : 'descending') : undefined
              }
            >
              <span
                className={cn(
                  'inline-flex items-center gap-tight',
                  align === 'right' && 'justify-end',
                  align === 'center' && 'justify-center',
                )}
              >
                {column.label}
                {column.filterApplied && (
                  // Persistent column-level "filter applied" indicator. The
                  // hover-reveal cross-filter affordance stays in the cell;
                  // this signals at a glance which columns are filtered.
                  <Filter
                    role="img"
                    aria-label="Filter applied"
                    className="size-icon-sm text-primary"
                  />
                )}
                {isSortable &&
                  (isSorted ? (
                    table.sort.direction === 'asc' ? (
                      <ChevronUp className="size-icon" />
                    ) : (
                      <ChevronDown className="size-icon" />
                    )
                  ) : (
                    <ChevronsUpDown className="size-icon opacity-30" />
                  ))}
              </span>
            </th>
          )

          if (column.tooltip) {
            return (
              <TooltipHelp
                key={column.id}
                asChild
                title={column.tooltip.title}
                description={column.tooltip.description}
                data-testid={`table-column-tooltip-${column.id}`}
              >
                {th}
              </TooltipHelp>
            )
          }
          return th
        })}
        {table.rowActions && <th className="w-12 section-content-padding" aria-label="Actions" />}
      </tr>
    </thead>
  )
}

/**
 * Table body. Renders one row per record (or `pageSize` skeleton rows while
 * `isPending`). Honors per-column `render`, `cellTrigger`, and `align`.
 *
 * @when Custom body styling (rare). Default Table layout already includes
 *   it.
 */
// Standard focusable descendants of a row. Excludes hidden inputs and
// disabled controls. The row's own `<tr>` is always filtered out by the
// `rowEl !== el` check at the call site since `<tr>` doesn't match any of
// these element selectors.
const ROW_FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])'

function getRowFocusables(rowEl: HTMLTableRowElement): HTMLElement[] {
  return Array.from(rowEl.querySelectorAll<HTMLElement>(ROW_FOCUSABLE_SELECTOR))
}

export function TableBody({ className, ref, ...rest }: TableBodyProps) {
  const { table } = useTableContext()
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([])
  const [activeRowIndex, setActiveRowIndex] = useState(0)
  // Active column within the row: -1 = the row anchor itself, 0+ = index
  // into `getRowFocusables(rowEl)`. Drives the roving tabindex.
  const [activeCol, setActiveCol] = useState(-1)
  const activeIndex = Math.min(Math.max(0, activeRowIndex), Math.max(0, table.rows.length - 1))

  // Sync `tabIndex` after each render. Cell content comes from arbitrary
  // `column.render` / `rowActions` callers, so we can't enforce this
  // declaratively. Text-like inputs stay in sequential Tab order (qty
  // columns); buttons/links/checkboxes keep the single-tab-stop roving
  // model. Hook order requires this run unconditionally; on early-return
  // frames `rowRefs` is empty so the loop is a no-op.
  useEffect(() => {
    rowRefs.current.forEach((rowEl, idx) => {
      if (!rowEl) return
      const focusables = getRowFocusables(rowEl)
      const isActive = idx === activeIndex
      const hasSequentialField = focusables.some(isSequentialTableTabField)
      focusables.forEach((el, colIdx) => {
        el.tabIndex = tableCellTabIndex(
          isSequentialTableTabField(el),
          isActive && colIdx === activeCol,
        )
      })
      rowEl.tabIndex = tableRowTabIndex(
        isActive && activeCol === -1,
        hasSequentialField,
      )
    })
  })

  // Pending: render `pageSize` skeleton rows so the body keeps the same
  // shape (height, row count, column rhythm) it will have once data lands.
  if (table.isPending) {
    return (
      <tbody ref={ref} className={className} {...rest}>
        {Array.from({ length: table.pagination.pageSize }, (_, i) => (
          <tr key={`skeleton-${i}`} className="border-b border-border last:border-b-0">
            {table.enableSelection && (
              <td className="w-10 section-content-padding">
                <Skeleton className="size-4" />
              </td>
            )}
            {table.columns.map((column) => {
              const align = column.align ?? 'left'
              return (
                <td
                  key={column.id}
                  className={cn(
                    'section-content-padding',
                    align === 'right' && 'text-right',
                    align === 'center' && 'text-center',
                  )}
                >
                  <Skeleton
                    className={cn(
                      'inline-block h-4 w-3/4 align-middle',
                      align === 'right' && 'ml-auto',
                      align === 'center' && 'mx-auto',
                    )}
                  />
                </td>
              )
            })}
            {table.rowActions && <td className="w-12 section-content-padding" />}
          </tr>
        ))}
      </tbody>
    )
  }

  if (table.rows.length === 0) return null

  // Grid navigation. Buttons, links, and checkboxes use a roving tabindex
  // so Tab enters the body once and exits to the next region. Text-like
  // inputs stay in sequential Tab order so a qty column can be edited
  // down the list. Right/Left arrows walk focusables within the row;
  // Up/Down move between rows while preserving the column position.

  function focusRowAnchor(rowIdx: number) {
    setActiveRowIndex(rowIdx)
    setActiveCol(-1)
    rowRefs.current[rowIdx]?.focus()
  }

  function focusCell(rowIdx: number, colIdx: number) {
    const rowEl = rowRefs.current[rowIdx]
    if (!rowEl) return
    const focusables = getRowFocusables(rowEl)
    if (focusables.length === 0) {
      focusRowAnchor(rowIdx)
      return
    }
    const clamped = Math.max(0, Math.min(focusables.length - 1, colIdx))
    setActiveRowIndex(rowIdx)
    setActiveCol(clamped)
    focusables[clamped].focus()
  }

  function handleBodyKeyDown(e: ReactKeyboardEvent<HTMLTableSectionElement>) {
    const target = e.target as HTMLElement
    const rowEl = target.closest<HTMLTableRowElement>('tr')
    if (!rowEl) return
    const rowIdx = rowRefs.current.indexOf(rowEl)
    if (rowIdx === -1) return

    // Don't hijack arrows / Home / End on text inputs, textareas, selects,
    // or contenteditable — they have native cursor / option semantics.
    const tag = target.tagName
    const isTextField =
      tag === 'TEXTAREA' ||
      tag === 'SELECT' ||
      target.isContentEditable ||
      (tag === 'INPUT' &&
        !/^(checkbox|radio|button|submit|reset)$/i.test((target as HTMLInputElement).type))
    if (
      isTextField &&
      (e.key === 'ArrowRight' ||
        e.key === 'ArrowLeft' ||
        e.key === 'ArrowUp' ||
        e.key === 'ArrowDown' ||
        e.key === 'Home' ||
        e.key === 'End')
    ) {
      return
    }

    const focusables = getRowFocusables(rowEl)
    const onRowAnchor = target === rowEl
    const colIdx = onRowAnchor ? -1 : focusables.indexOf(target)
    // Focus is on something that doesn't belong to the roving model
    // (e.g., a portaled menu item rendered outside the row). Let the
    // owning component handle keys.
    if (!onRowAnchor && colIdx === -1) return

    switch (e.key) {
      case 'ArrowRight': {
        if (focusables.length === 0) return
        if (colIdx >= focusables.length - 1) return
        e.preventDefault()
        const next = colIdx + 1
        setActiveCol(next)
        focusables[next].focus()
        break
      }
      case 'ArrowLeft': {
        if (onRowAnchor) return
        e.preventDefault()
        const next = colIdx - 1
        if (next < 0) focusRowAnchor(rowIdx)
        else {
          setActiveCol(next)
          focusables[next].focus()
        }
        break
      }
      case 'ArrowDown': {
        if (rowIdx >= table.rows.length - 1) return
        e.preventDefault()
        if (onRowAnchor) focusRowAnchor(rowIdx + 1)
        else focusCell(rowIdx + 1, colIdx)
        break
      }
      case 'ArrowUp': {
        if (rowIdx <= 0) return
        e.preventDefault()
        if (onRowAnchor) focusRowAnchor(rowIdx - 1)
        else focusCell(rowIdx - 1, colIdx)
        break
      }
      case 'Home': {
        e.preventDefault()
        if (onRowAnchor) focusRowAnchor(0)
        else focusCell(0, colIdx)
        break
      }
      case 'End': {
        e.preventDefault()
        const last = table.rows.length - 1
        if (onRowAnchor) focusRowAnchor(last)
        else focusCell(last, colIdx)
        break
      }
      // Enter / Space intentionally not handled at the row anchor — cells
      // own their own activation. Anchor cells render <Link> which natively
      // handles Enter; onClick cells (e.g. cross-filter) carry their own
      // semantics. Multiple href cells per row each act as independent
      // links via the roving-tabindex arrow-key model.
    }
  }

  function handleBodyFocus(e: ReactFocusEvent<HTMLTableSectionElement>) {
    const target = e.target as HTMLElement
    const rowEl = target.closest<HTMLTableRowElement>('tr')
    if (!rowEl) return
    const rowIdx = rowRefs.current.indexOf(rowEl)
    if (rowIdx === -1) return

    if (target === rowEl) {
      setActiveRowIndex(rowIdx)
      setActiveCol(-1)
      return
    }
    const focusables = getRowFocusables(rowEl)
    const colIdx = focusables.indexOf(target)
    if (colIdx === -1) return // portaled descendant — don't disturb state
    setActiveRowIndex(rowIdx)
    setActiveCol(colIdx)
  }

  return (
    <tbody
      ref={ref}
      className={className}
      onKeyDown={handleBodyKeyDown}
      onFocus={handleBodyFocus}
      {...rest}
    >
      {table.rows.map((row, index) => {
        const rowId = table.getRowId(row)
        const selected = table.enableSelection && table.selection.isSelected(rowId)
        // Values are frozen, so the row must not read as authoritative. The
        // non-visual signal is the departed count in the notice's live region
        // — a per-row sr-only cell would desync the column count.
        const departed = table.live?.departedIds?.has(rowId) ?? false
        const flashed = table.live?.flashedIds?.has(rowId) ?? false

        return (
          <tr
            key={rowId}
            ref={(el) => {
              rowRefs.current[index] = el
            }}
            tabIndex={index === activeIndex && activeCol === -1 ? 0 : -1}
            className={cn(
              'border-b border-border last:border-b-0 transition-colors hover:bg-interactive',
              selected && 'bg-selected',
              departed && 'opacity-50',
              flashed && 'table-row-arrived',
            )}
            data-selected={selected || undefined}
            data-departed={departed || undefined}
            data-arrived={flashed || undefined}
          >
            {table.enableSelection && (
              <td className="w-10 section-content-padding">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => table.selection.toggle(rowId)}
                  aria-label={`Select row ${rowId}`}
                />
              </td>
            )}
            {table.columns.map((column) => {
              const value = table.getCellValue(row, column)
              const cellContent: ReactNode = column.render
                ? column.render({ value, record: row })
                : value == null
                  ? null
                  : String(value)
              const action = column.cellTrigger
              const align = column.align ?? 'left'
              const alignTd = cn(
                align === 'right' && 'text-right',
                align === 'center' && 'text-center',
              )
              const alignFlex = cn(
                align === 'right' && 'justify-end',
                align === 'center' && 'justify-center',
              )
              // Per-column truncate overrides the table-wide setting.
              const truncate = column.truncate ?? table.truncate
              const piiClass = column.pii ? PII_MASK_CLASS : undefined

              if (!action) {
                return (
                  <td
                    key={column.id}
                    className={cn(
                      'section-content-padding',
                      alignTd,
                      truncate && 'truncate',
                      piiClass,
                    )}
                  >
                    {cellContent}
                  </td>
                )
              }

              // Cell affordance is hover-reveal only. The persistent
              // "filter applied" state lives on the column header now
              // (`column.filterApplied`), not per-cell.
              const inner = (
                <>
                  <span className={cn('flex min-w-0 items-center', truncate && 'truncate')}>
                    {cellContent}
                  </span>
                  <span
                    className={cn(
                      'shrink-0 text-primary transition-all duration-200 ease-out',
                      // Hidden by default, slides in on row hover.
                      'opacity-0 -translate-x-3 group-hover:opacity-100 group-hover:translate-x-0',
                    )}
                    aria-hidden="true"
                  >
                    {action.icon}
                  </span>
                </>
              )

              if (action.href) {
                return (
                  <td
                    key={column.id}
                    className={cn('section-content-padding group', alignTd, piiClass)}
                  >
                    <Tooltip content={action.tooltip} hoverable={false}>
                      <Link
                        href={action.href({ value, row })}
                        title={action.tooltip}
                        className={cn('flex items-center gap-1.5 hover:text-primary', alignFlex)}
                      >
                        {inner}
                      </Link>
                    </Tooltip>
                  </td>
                )
              }

              return (
                <td
                  key={column.id}
                  className={cn(
                    'section-content-padding group cursor-pointer hover:text-primary',
                    alignTd,
                    piiClass,
                  )}
                  onClick={() => action.onClick({ value, row })}
                >
                  <Tooltip content={action.tooltip} hoverable={false}>
                    <span className={cn('flex items-center gap-1.5', alignFlex)}>{inner}</span>
                  </Tooltip>
                </td>
              )
            })}
            {table.rowActions && (
              <td className="w-12 section-content-padding">
                <div className="flex justify-end">{table.rowActions(row)}</div>
              </td>
            )}
          </tr>
        )
      })}
    </tbody>
  )
}

/**
 * Empty state row. Suppressed while `isPending` (the Body shows skeletons
 * during initial load). Renders `children` (or "No results.") when there
 * are zero rows. When the backing query failed (`isError`), renders an
 * `ErrorState` card instead — a failed load must never read as "No results."
 *
 * @when Customizing the empty message — usually pass `emptyMessage` to the
 *   Table root instead. Use this slot for richer empty UI (CTAs, links).
 */
export function TableEmpty({ children, className, ref, ...rest }: TableEmptyProps) {
  const { table, containerWidth } = useTableContext()

  // Suppress empty state while loading so "No results" doesn't flash before
  // data arrives. TableBody owns the loading indicator.
  if (table.isPending) return null
  if (table.rows.length > 0) return null

  const colSpan =
    table.columns.length + (table.enableSelection ? 1 : 0) + (table.rowActions ? 1 : 0)

  return (
    <tbody ref={ref} className={className} {...rest}>
      <tr>
        <td colSpan={colSpan} className="text-center text-fg-secondary">
          {/* When the columns overflow the scroller, a full-table-width cell
              would center the message half off-screen — pin it to the
              visible strip instead: sticky-left with the scroller's measured
              width (CORE-990). Pre-measurement the width is unset for one
              frame, which lays out at natural cell width — fine. */}
          <div
            className="sticky left-0 flex min-h-24 items-center justify-center"
            style={{ width: containerWidth ?? undefined }}
          >
            {table.isError ? (
              <ErrorState
                title="Couldn't load results"
                message="Something went wrong loading this list."
                onRetry={table.onRetry ?? undefined}
                retrying={table.isFetching}
                data-testid="table-error-state"
              />
            ) : (
              (children ?? 'No results.')
            )}
          </div>
        </td>
      </tr>
    </tbody>
  )
}

/**
 * Pagination controls. Page-size select, range readout ("1–10 of 42"), and
 * prev/next buttons. Hidden during `isPending` to suppress flicker; absent
 * when `enablePagination` is false.
 *
 * @when Custom positioning of pagination — most usage relies on the
 *   default slot at the bottom of the Table.
 */
export function TablePagination({ className, ref, ...rest }: TablePaginationProps) {
  const { table, sticky } = useTableContext()
  const { pagination } = table
  const previousBtnRef = useRef<HTMLButtonElement>(null)
  const nextBtnRef = useRef<HTMLButtonElement>(null)
  // After clicking a page-step button that turns out to be the last possible
  // step (next page is also the last page, etc.), the button becomes
  // `disabled` and the browser drops focus. Hand focus to the sibling so
  // keyboard users don't get punted to the document body.
  const pendingFocusRef = useRef<'next' | 'previous' | null>(null)

  useEffect(() => {
    const target = pendingFocusRef.current
    if (!target) return
    pendingFocusRef.current = null
    if (target === 'next') {
      if (pagination.canNextPage) nextBtnRef.current?.focus()
      else previousBtnRef.current?.focus()
    } else {
      if (pagination.canPreviousPage) previousBtnRef.current?.focus()
      else nextBtnRef.current?.focus()
    }
  }, [pagination.page, pagination.canNextPage, pagination.canPreviousPage])

  if (!table.enablePagination) return null
  // Hide pagination chrome during initial load so "1–0 of 0" doesn't flash
  // before data arrives. Reappears once isPending flips to false. Same for
  // a failed empty load — the error card owns the body, "1–0 of 0" under it
  // is noise.
  if (table.isPending) return null
  if (table.isError && table.rows.length === 0) return null

  // In cursor-controlled mode, page is 0 and totalItems may be -1 (unknown).
  // Fall back to showing just the page size or nothing usable.
  const totalKnown = pagination.totalItems >= 0
  const rangeStart = pagination.page * pagination.pageSize + 1
  const rangeEnd = totalKnown
    ? Math.min((pagination.page + 1) * pagination.pageSize, pagination.totalItems)
    : pagination.page * pagination.pageSize + pagination.pageSize

  return (
    <div
      ref={ref}
      className={cn(
        // `shrink-0`: static chrome below the card's internal scroller — it
        // must keep its height when the sticky cap squeezes the card.
        'flex shrink-0 items-center justify-between border-t border-border section-content-padding text-body',
        sticky ? 'bg-surface-card' : 'bg-interactive-hover',
        // Hide pagination chrome in print runs — page navigation is
        // meaningless on paper; readers want the full dataset.
        'print:hidden',
        className,
      )}
      {...rest}
    >
      <div className="flex items-center gap-action text-fg-secondary">
        <span>Rows per page</span>
        <select
          value={pagination.pageSize}
          onChange={(e) => pagination.setPageSize(Number(e.target.value))}
          className="interactable item-padding border border-border bg-surface-card text-input"
          aria-label="Rows per page"
        >
          {pagination.pageSizeOptions.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-region">
        <span className="text-fg-secondary" aria-live="polite">
          {totalKnown ? (
            <>
              {rangeStart}–{rangeEnd} of {pagination.totalItems}
            </>
          ) : (
            <>
              {rangeStart}–{rangeEnd}
            </>
          )}
        </span>
        <div className="flex gap-tight">
          <button
            ref={previousBtnRef}
            type="button"
            tabIndex={0}
            onClick={() => {
              pendingFocusRef.current = 'previous'
              pagination.previous()
            }}
            disabled={!pagination.canPreviousPage}
            className="interactable subtle disableable p-item-y"
            aria-label="Previous page"
          >
            <ChevronLeft className="size-icon-lg" />
          </button>
          <button
            ref={nextBtnRef}
            type="button"
            tabIndex={0}
            onClick={() => {
              pendingFocusRef.current = 'next'
              pagination.next()
            }}
            disabled={!pagination.canNextPage}
            className="interactable subtle disableable p-item-y"
            aria-label="Next page"
          >
            <ChevronRight className="size-icon-lg" />
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Bulk-actions bar. Renders only when `enableSelection` is on AND at least
 * one row is selected. Shows a count + caller-provided action buttons.
 *
 * @when Multi-row operations (Archive, Delete, Tag) on selectable tables.
 *   Pass action buttons as children.
 * @avoid Putting per-row actions here — those belong in `useTable`'s
 *   `rowActions` slot.
 */
export function TableBulkActions({ children, className, ref, ...rest }: TableBulkActionsProps) {
  const { table } = useTableContext()

  if (!table.enableSelection || table.selection.count === 0) return null

  return (
    <div
      ref={ref}
      className={cn(
        // `shrink-0`: static chrome below the card's internal scroller.
        'flex shrink-0 items-center gap-region border-t border-border bg-selected section-content-padding text-body',
        className,
      )}
      {...rest}
    >
      <span className="font-medium">{table.selection.count} selected</span>
      {children}
    </div>
  )
}

/**
 * Announces rows the live buffer is holding back. Renders nothing when the
 * table isn't live or nothing is pending.
 *
 * Static chrome above the card's internal scroller — always visible, never
 * scrolls with the rows (the scroller sits between this and the bars below).
 *
 * @when Any live table. Pair with `useLiveRows` upstream and pass its state as
 *   `useTable`'s `live` option.
 * @avoid Rendering it outside `<Table>` — it reads the table context. Using it
 *   as a general banner slot; it is specifically the pending-rows affordance.
 * @tokens bg-info-tint + border-border (notice surface), section-content-padding
 *   (row rhythm), text-body-sm, interactable (the action)
 */
export function TableLiveNotice({ children, className, ref, ...rest }: TableLiveNoticeProps) {
  const { table } = useTableContext()
  const selfRef = useRef<HTMLDivElement | null>(null)
  const live = table.live

  if (!live) return null
  if (!live.hasPendingChanges) return null

  // Gate on `hasPendingChanges`, not the count: a pure removal has nothing to
  // count but still needs a way to clear. Only the copy keys on the count.
  const canPromiseCount = live.mode === 'insert' && live.pendingCount > 0

  const departedCount = live.departedIds?.size ?? 0
  const label = canPromiseCount
    ? `${live.pendingCount} new ${live.pendingCount === 1 ? 'row' : 'rows'}`
    : departedCount > 0
      ? // The only channel a screen-reader user has for the dimmed rows.
        `${departedCount} ${departedCount === 1 ? 'row' : 'rows'} no longer ${departedCount === 1 ? 'matches' : 'match'} — shown until refreshed`
      : 'This view has changed'

  // Committing while paged away would shift the page for no visible reason and
  // leave the new rows off-screen, so reset to page 0 and scroll to the top
  // first. Instant, not smooth: it's a navigation, and it sidesteps
  // `prefers-reduced-motion`.
  const handleCommit = () => {
    if (canPromiseCount) {
      table.pagination.setPage(0)
      const node = selfRef.current
      // Feature-detected: adopting the rows must never depend on the scroll
      // landing (jsdom has no implementation, and a throw here would swallow
      // the commit entirely).
      if (node && typeof node.scrollIntoView === 'function') {
        node.scrollIntoView({ block: 'start', behavior: 'auto' })
      }
    }
    live.onCommit()
  }

  return (
    <div
      ref={(node) => {
        selfRef.current = node
        if (typeof ref === 'function') ref(node)
        else if (ref) ref.current = node
      }}
      // `role="status"` + polite live region: the count is the only channel a
      // screen-reader user has for pending rows, since the visual bar and the
      // eventual row insertion are both silent. It sits outside the table's
      // roving-tabindex composite by design — it is chrome, not a row, so it
      // must not join the grid's tab order or its row count.
      role="status"
      aria-live="polite"
      className={cn(
        // `shrink-0`: static chrome above the card's internal scroller.
        'flex shrink-0 items-center justify-between gap-region border-b border-border bg-info-tint section-content-padding text-body-sm',
        className,
      )}
      {...rest}
    >
      <span className="text-fg-secondary">{label}</span>
      {children ?? (
        <button
          type="button"
          onClick={handleCommit}
          // Explicit tabIndex: Safari skips plain buttons in the tab order
          // unless "Press Tab to highlight each item" is on (see
          // `concepts/accessibility.md`).
          tabIndex={0}
          className="interactable ghost item-padding font-medium"
        >
          {canPromiseCount ? 'Show' : 'Refresh'}
        </button>
      )}
    </div>
  )
}
