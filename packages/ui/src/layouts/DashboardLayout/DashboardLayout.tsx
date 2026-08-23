'use client'

// `Cell boundary` renders a function child into `QueryErrorResetBoundary` + a class
// `ErrorBoundary` — both client-only. Marked `'use client'` so a future server-component
// consumer can't trip "Functions cannot be passed to Client Components" (all consumers are
// client today, so this is defensive).
import { Children, isValidElement, type ComponentPropsWithRef, type ReactNode } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { QueryErrorResetBoundary } from '@tanstack/react-query'
import { ErrorBoundary } from '#ds/ui/ErrorBoundary'
import { cn } from '#cn'

// ---------------------------------------------------------------------------
// Variants
// ---------------------------------------------------------------------------

// Each cell is full-width (`col-span-12`) until the dashboard container reaches
// the `--container-dash-grid` threshold (1110px), then it claims its column
// span. The breakpoint keys off a named container (`@container/dashboard` on the
// Root) so it reflects the dashboard's own rendered width — independent of
// sidenav state, which only changes how wide the dashboard renders. The 12
// literal class pairs are enumerated because Tailwind's JIT only detects literal
// class names; a computed `col-span-${n}` would never be generated.
const cellVariants = cva('', {
  variants: {
    colSpan: {
      1: 'col-span-12 @dash-grid/dashboard:col-span-1',
      2: 'col-span-12 @dash-grid/dashboard:col-span-2',
      3: 'col-span-12 @dash-grid/dashboard:col-span-3',
      4: 'col-span-12 @dash-grid/dashboard:col-span-4',
      5: 'col-span-12 @dash-grid/dashboard:col-span-5',
      6: 'col-span-12 @dash-grid/dashboard:col-span-6',
      7: 'col-span-12 @dash-grid/dashboard:col-span-7',
      8: 'col-span-12 @dash-grid/dashboard:col-span-8',
      9: 'col-span-12 @dash-grid/dashboard:col-span-9',
      10: 'col-span-12 @dash-grid/dashboard:col-span-10',
      11: 'col-span-12 @dash-grid/dashboard:col-span-11',
      12: 'col-span-12 @dash-grid/dashboard:col-span-12',
    },
  },
  defaultVariants: {
    colSpan: 12,
  },
})

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DashboardLayoutProps extends ComponentPropsWithRef<'div'> {
  /**
   * Render the static, print-friendly arrangement (no scroll clipping, natural
   * height) for export/PDF capture. Sets a `data-export` attribute the body
   * reacts to. The actual print run is also covered by `print:` variants, so
   * this prop is only needed to preview/screenshot export mode on screen.
   */
  exportMode?: boolean
  children: ReactNode
}

export type DashboardLayoutHeaderProps = ComponentPropsWithRef<'div'>

export type DashboardLayoutFiltersProps = ComponentPropsWithRef<'div'>

export type DashboardLayoutGridProps = ComponentPropsWithRef<'div'>

export type DashboardLayoutRowProps = ComponentPropsWithRef<'div'>

export interface DashboardLayoutCellProps
  extends ComponentPropsWithRef<'div'>, VariantProps<typeof cellVariants> {
  /**
   * Isolate this cell's widget behind a per-cell error boundary. An initial-load
   * failure renders a contained fallback (default `ErrorState`) instead of taking
   * down the page; the fallback's retry resets failed queries via
   * `QueryErrorResetBoundary`, so the widget refetches. Default off — existing
   * cells are unaffected.
   */
  boundary?: boolean
  /** Custom boundary fallback (only used when `boundary`). Receives the error + a query-resetting `reset`. */
  boundaryFallback?: (props: { error: Error; reset: () => void }) => ReactNode
  /**
   * Reset signature for the cell's boundary (only used when `boundary`). When any value changes, an
   * errored widget auto-recovers — so a widget that failed on a bad filter refetches once the
   * filter changes, without the user clicking retry. Pass the active-filter signature.
   */
  boundaryResetKeys?: readonly unknown[]
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface SplitResult {
  header: ReactNode
  filters: ReactNode
  grid: ReactNode
}

function splitChildren(children: ReactNode): SplitResult {
  let header: ReactNode = null
  let filters: ReactNode = null
  let grid: ReactNode = null

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return
    if (child.type === DashboardLayoutHeader) header = child
    else if (child.type === DashboardLayoutFilters) filters = child
    else if (child.type === DashboardLayoutGrid) grid = child
  })

  return { header, filters, grid }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/**
 * Top-level header region. Padding only — the border divider is applied by the
 * Root's wrapper, so this component provides internal spacing alone (mirrors
 * `ExplorerView.Header`).
 *
 * @when Page titles, actions, export buttons. Slot a `PageHeader` here.
 * @avoid Adding a bottom border here — the Root wrapper owns the divider, and
 *   doubling it draws two lines.
 * @tokens px-canvas py-region-y (region padding)
 */
export function DashboardLayoutHeader({
  children,
  className,
  ref,
  ...rest
}: DashboardLayoutHeaderProps) {
  return (
    <div ref={ref} className={cn('px-canvas py-region-y', className)} {...rest}>
      {children}
    </div>
  )
}

/**
 * Optional filter-bar region between the header and the widget grid. Renders
 * nothing when omitted (the Root splits it out by type).
 *
 * @when A dashboard needs a filter bar (date range, principals) above the grid.
 * @tokens px-canvas py-region-y (region padding)
 */
export function DashboardLayoutFilters({
  children,
  className,
  ref,
  ...rest
}: DashboardLayoutFiltersProps) {
  return (
    <div ref={ref} className={cn('flex-shrink-0 px-canvas py-region-y', className)} {...rest}>
      {children}
    </div>
  )
}

/**
 * Scrollable body that fills the remaining vertical space and holds the widget
 * rows. In export mode (Root `data-export`) and during print, the scroll/clip
 * is dropped so content flows to natural height and nothing is cut off in PDF.
 *
 * @when The grid region of a dashboard. Holds `DashboardLayout.Row`s.
 * @avoid Putting widgets directly here — wrap each row in
 *   `DashboardLayout.Row` so the 12-column grid applies.
 * @tokens p-canvas (body padding), gap-region (row gap)
 */
export function DashboardLayoutGrid({
  children,
  className,
  ref,
  ...rest
}: DashboardLayoutGridProps) {
  // tabIndex={-1} + focus:outline-none keeps Firefox from inserting the scroll
  // container into the tab sequence (per accessibility.md). Children own focus.
  return (
    <div
      ref={ref}
      tabIndex={-1}
      className={cn(
        'flex flex-1 flex-col gap-region overflow-auto p-canvas focus:outline-none',
        'print:flex-none print:overflow-visible',
        'group-data-export/dashboard:flex-none group-data-export/dashboard:overflow-visible',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
}

/**
 * A single row of the widget grid. A 12-column CSS grid — child
 * `DashboardLayout.Cell`s claim columns via `colSpan`, and the spans in a row
 * should sum to 12.
 *
 * @when Grouping widgets that sit side by side. One per visual row.
 * @avoid Spans summing past 12 — the overflow cell wraps to the next grid line.
 * @tokens gap-region (column gutter)
 */
export function DashboardLayoutRow({ children, className, ref, ...rest }: DashboardLayoutRowProps) {
  return (
    <div
      ref={ref}
      className={cn('grid grid-cols-12 items-stretch gap-region', className)}
      {...rest}
    >
      {children}
    </div>
  )
}

/**
 * A widget slot within a `DashboardLayout.Row`. Claims `colSpan` of 12 columns
 * once the dashboard is ≥1110px wide; collapses to full width below that.
 * Carries no chrome of its own — the widget inside (a `Panel`) owns its
 * surface and padding.
 *
 * @when Wrap each widget/indicator group in a row. Pick `colSpan` so the row
 *   sums to 12 (e.g. 8 + 4, 6 + 6, or a single 12). Set `boundary` to isolate a
 *   data widget so its failure can't take down the rest of the dashboard.
 * @avoid Adding a boundary to purely static cells — it only earns its keep when
 *   the cell owns a data fetch that can fail.
 * @tokens col-span-* (grid column span)
 */
export function DashboardLayoutCell({
  children,
  className,
  colSpan,
  boundary,
  boundaryFallback,
  boundaryResetKeys,
  ref,
  ...rest
}: DashboardLayoutCellProps) {
  return (
    <div
      ref={ref}
      className={cn(
        cellVariants({ colSpan }),
        // Export/PDF (dashboard `exportMode` → `data-export` on the group root): stack every
        // widget full-width (single column) regardless of the container-query breakpoint, and keep
        // each widget whole across page breaks. The `group-data-export` selector out-specifies the
        // `@dash-grid` container-query `col-span-*`, so it wins without `!important`.
        'group-data-export/dashboard:col-span-12 print:break-inside-avoid',
        className,
      )}
      {...rest}
    >
      {boundary ? (
        <QueryErrorResetBoundary>
          {({ reset }) => (
            <ErrorBoundary
              onReset={reset}
              fallback={boundaryFallback}
              resetKeys={boundaryResetKeys}
            >
              {children}
            </ErrorBoundary>
          )}
        </QueryErrorResetBoundary>
      ) : (
        children
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

/**
 * Dashboard / KPI-grid layout. Structures a page into a `Header`, optional
 * `Filters` bar, and a scrollable `Grid` of widget rows. Sub-components are
 * slotted by type — place them in any order.
 *
 * A pure layout: no data dependencies, no state, no context. The Root is the
 * named container `@container/dashboard`, so cell collapse keys off the
 * dashboard's own width (≥1110px → multi-column, below → stacked) regardless
 * of sidenav state.
 *
 * @when Building dashboard pages with a header, filters, and a widget grid.
 * @avoid List/table pages — use `ExplorerView`. Detail pages — use `DetailView`.
 *   Passing children other than `Header`, `Filters`, or `Grid` — they are
 *   matched by type and anything else is silently dropped; on a duplicate slot
 *   the last one wins.
 */
export function DashboardLayoutRoot({
  children,
  className,
  exportMode,
  ref,
  ...rest
}: DashboardLayoutProps) {
  const { header, filters, grid } = splitChildren(children)

  return (
    <div
      ref={ref}
      // Render a bare, valueless `data-export` attribute when on, and omit it
      // entirely when off. The `data-export:` / `group-data-export/dashboard:`
      // variants compile to presence selectors (`[data-export]`), so `''` makes the
      // attribute exist (matches) and `undefined` makes React drop it (no
      // match). A boolean would render `data-export="false"`, which a presence
      // selector still matches — leaving export styling stuck on.
      data-export={exportMode ? '' : undefined}
      className={cn(
        'group/dashboard @container/dashboard flex h-full flex-col',
        'print:h-auto print:min-h-0',
        'data-export:h-auto data-export:min-h-0',
        className,
      )}
      {...rest}
    >
      {/* The header/content divider is dropped in export mode — the PDF's report masthead flows
          straight into the first block without a rule. */}
      {header && (
        <div className={cn('flex-shrink-0', !exportMode && 'border-b border-border')}>{header}</div>
      )}
      {filters}
      {grid}
    </div>
  )
}
