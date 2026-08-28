'use client'

import {
  TableRoot,
  TableHeader,
  TableBody,
  TableEmpty,
  TablePagination,
  TableBulkActions,
  TableLiveNotice,
} from './Table'

export { useTable, useSort, useSelection, usePagination } from './Table.hook'
export type {
  CellTrigger,
  ControlledPagination,
  PaginationAction,
  SortState,
  TableColumnDef,
  TableInstance,
  TableLiveState,
  TableTooltip,
  UseTableOptions,
  UseSortReturn,
  UseSelectionReturn,
  UsePaginationOptions,
  UsePaginationReturn,
} from './Table.hook'

/**
 * Headless data table with built-in sort, selection, pagination, and
 * cell-trigger affordances. Driven by a `useTable()` instance — sub-slots
 * (Header, Body, Empty, Pagination, BulkActions) read everything from
 * context.
 *
 * @when Any tabular display of records — explorers, account/source/license
 *   listings, dashboard tables. Pair with `useTable()` to wire data, sort,
 *   pagination, and selection.
 * @avoid Read-only key/value displays — use `DescriptionList`. Resource
 *   tables that need filter bars and action menus — use `ResourceTable`
 *   (it composes this Table internally).
 */
export const Table = Object.assign(TableRoot, {
  Header: TableHeader,
  Body: TableBody,
  Empty: TableEmpty,
  Pagination: TablePagination,
  BulkActions: TableBulkActions,
  LiveNotice: TableLiveNotice,
})
