import {
  ExplorerViewRoot,
  ExplorerViewHeader,
  ExplorerViewContent,
  ExplorerViewCreateDialog,
  ExplorerViewCreateButton,
  useExplorerView,
} from './ExplorerView'

/**
 * Explorer-style layout with Header, scrollable Content, and an optional
 * create Dialog. Provides context so `ExplorerView.CreateButton` can open the
 * dialog from anywhere within the tree.
 *
 * @when Building list/grid explorer pages with an optional create action.
 * @avoid Using without a Header or Content sub-component.
 * @tokens border-border (header divider)
 */
export const ExplorerView = Object.assign(ExplorerViewRoot, {
  Header: ExplorerViewHeader,
  Content: ExplorerViewContent,
  CreateDialog: ExplorerViewCreateDialog,
  CreateButton: ExplorerViewCreateButton,
})

export { useExplorerView }
