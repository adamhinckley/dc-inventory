import {
  DescriptionListRoot,
  DescriptionListHeading,
  DescriptionListItem,
  DescriptionListTerm,
  DescriptionListData,
} from './DescriptionList'

export type {
  DescriptionListProps,
  DescriptionListHeadingProps,
  DescriptionListItemProps,
  DescriptionListTermProps,
  DescriptionListDataProps,
} from './DescriptionList'

export { useRecord } from './DescriptionList'

/**
 * Key/value display grid. Renders a section-elevation card containing a
 * responsive grid of label + value pairs. Supports static children
 * (`DescriptionList.Item`) or resource-aware children (`ResourceEntry`)
 * resolved against the `record` prop.
 *
 * @when Detail-page summary cards, metadata panels, settings read-out — any
 *   "the things to know about this resource" data display.
 * @avoid Editable forms — use `Form` with field labels. Tables of many
 *   records — use `ResourceTable`. Inside a modal/overlay (`Dialog`, `Drawer`)
 *   — this renders a `.section` card (glassmorphic gradient border + radial
 *   glow + its own `surface-card` background), which nests badly on the overlay
 *   surface (mismatched background, stray inner border). Render plain key/value
 *   markup that inherits the overlay surface instead (`<dl>` with
 *   `section-content-label` terms + `section-content-value` data).
 * @variants variant (`primary`/`secondary`)
 */
export const DescriptionList = Object.assign(DescriptionListRoot, {
  Heading: DescriptionListHeading,
  Item: DescriptionListItem,
  Term: DescriptionListTerm,
  Data: DescriptionListData,
})
