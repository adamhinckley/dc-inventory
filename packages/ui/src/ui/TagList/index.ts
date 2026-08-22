export type { TagListProps } from './TagList'

/**
 * Wraps a string array in `Chip` components separated by a flex gap.
 * Renders an optional `emptyFallback` when the array is empty/null.
 *
 * @when Display-only string lists — tags, categories, group memberships
 *   in table cells and detail panels.
 * @avoid Editable tag inputs — render a `Form.Field` with a custom
 *   control. Single status values — use `Chip` directly with a tint.
 */
export { TagList } from './TagList'
