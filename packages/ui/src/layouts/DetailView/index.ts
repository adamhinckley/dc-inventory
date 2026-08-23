'use client'

import {
  DetailViewRoot,
  DetailViewHeader,
  DetailViewSummary,
  DetailViewTabs,
  DetailViewEditDialog,
  DetailViewEditButton,
  useDetailView,
} from './DetailView'

export type {
  DetailViewProps,
  DetailViewHeaderProps,
  DetailViewSummaryProps,
  DetailViewTabsProps,
  DetailViewEditDialogProps,
} from './DetailView'

export { useDetailView }

/**
 * Detail page layout that structures an entity view into Header, Summary,
 * Tabs, and an optional EditDialog. Provides context for the EditButton
 * to toggle the dialog from anywhere in the tree.
 *
 * @when Building detail/show pages for a single entity with metadata summary,
 *   tabbed content, and optional inline editing.
 * @avoid Using for list/explorer pages — use ExplorerView instead.
 */
export const DetailView = Object.assign(DetailViewRoot, {
  Header: DetailViewHeader,
  Summary: DetailViewSummary,
  Tabs: DetailViewTabs,
  EditDialog: DetailViewEditDialog,
  EditButton: DetailViewEditButton,
})
