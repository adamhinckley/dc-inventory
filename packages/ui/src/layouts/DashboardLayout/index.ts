import {
  DashboardLayoutRoot,
  DashboardLayoutHeader,
  DashboardLayoutFilters,
  DashboardLayoutGrid,
  DashboardLayoutRow,
  DashboardLayoutCell,
} from './DashboardLayout'

export type {
  DashboardLayoutProps,
  DashboardLayoutHeaderProps,
  DashboardLayoutFiltersProps,
  DashboardLayoutGridProps,
  DashboardLayoutRowProps,
  DashboardLayoutCellProps,
} from './DashboardLayout'

/**
 * Dashboard / KPI-grid layout. A `Header`, optional `Filters` bar, and a
 * scrollable `Grid` of widget rows arranged on a 12-column grid that collapses
 * to a single column below 1110px of dashboard width. Pure layout — no data,
 * no state. Supports an `exportMode` prop for print/PDF-friendly rendering.
 *
 * @when Building dashboard pages: KPI grids, exposure overviews, widget boards.
 * @avoid List/table pages — use `ExplorerView`. Single-record detail pages —
 *   use `DetailView`.
 */
export const DashboardLayout = Object.assign(DashboardLayoutRoot, {
  Header: DashboardLayoutHeader,
  Filters: DashboardLayoutFilters,
  Grid: DashboardLayoutGrid,
  Row: DashboardLayoutRow,
  Cell: DashboardLayoutCell,
})
