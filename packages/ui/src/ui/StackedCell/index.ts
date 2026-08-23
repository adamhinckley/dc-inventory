/**
 * Dumb two-line stacked cell: a prominent primary line over a small, tertiary
 * secondary line — the layout primitive behind `NameCell` and the
 * `idTimestampCell()` `cellRender` factory.
 *
 * `idTimestampCell()` ships alongside it (full docs in `StackedCell.tsx`) for
 * the id-over-timestamp column (incidents, CORE-828).
 *
 * @when A table cell stacking one prominent value over a supporting one, in a
 *   column `cellRender` — either via `idTimestampCell()`, or `StackedCell`
 *   directly for an orientation the factory doesn't cover.
 * @avoid Name-first rows — use `NameCell`. Single-line displays — use plain
 *   text, `IdCell`, or `Timestamp`.
 */
export { StackedCell, idTimestampCell } from './StackedCell'
