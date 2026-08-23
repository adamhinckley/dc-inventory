import { NameCell as NameCellImpl, nameCell as nameCellImpl } from './NameCell'

/**
 * Two-line cell: resource display name on top, full id underneath. Renders
 * as nested `<span>`s so it's safe to nest inside an `<a>` trigger.
 *
 * @when Default `name` column renderer for resource tables. For the
 *   `cellRender` shorthand version, use the `nameCell()` factory.
 * @avoid Single-line displays — use plain text or `text-fg`. Detail-page
 *   headings — use `PageHeader.Title`.
 */
export const NameCell = NameCellImpl

/**
 * `cellRender` factory for the most common name-column pattern: render the
 * field's value as the primary line, the row's id as the secondary line.
 *
 * @when Declaring a resource table's `name` column override:
 *   `name: { cellRender: nameCell() }`. Pass `name(ctx)` when the display
 *   name is derived from the row rather than a single column value.
 * @avoid Calling outside a column override — render `<NameCell />` directly.
 */
export const nameCell = nameCellImpl
