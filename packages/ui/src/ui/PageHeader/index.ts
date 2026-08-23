import {
  PageHeaderRoot,
  PageHeaderHeaderRow,
  PageHeaderContent,
  PageHeaderTitle,
  PageHeaderSubtitle,
  PageHeaderActions,
} from './PageHeader'

export type {
  PageHeaderProps,
  PageHeaderHeaderRowProps,
  PageHeaderContentProps,
  PageHeaderTitleProps,
  PageHeaderSubtitleProps,
  PageHeaderActionsProps,
} from './PageHeader'

/**
 * Page-level title block. Page title + subtitle on the left, actions on the
 * right. Supports a loading state via `isPending` on `Title`/`Subtitle`.
 *
 * @when The top of every dashboard page — explorers, detail views, settings.
 *   Holds the resource name and primary actions.
 * @avoid Section-level titles inside a page — use `Panel.Title` for a card
 *   heading or a structural heading in the layout.
 */
export const PageHeader = Object.assign(PageHeaderRoot, {
  HeaderRow: PageHeaderHeaderRow,
  Content: PageHeaderContent,
  Title: PageHeaderTitle,
  Subtitle: PageHeaderSubtitle,
  Actions: PageHeaderActions,
})
