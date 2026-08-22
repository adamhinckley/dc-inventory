import type { ReactNode } from 'react'
import { PII_MASK_CLASS } from '#shared/constants/pii-mask'
import { cn } from '#cn'
import { formatDate } from '#shared/utils/format-date'
import type { RenderCtx } from '#shared/resource/types'

interface StackedCellProps {
  /**
   * Primary (top) line — the prominent value, rendered in the cell's default
   * text color/weight. Callers own the empty fallback (pass `'—'` when there's
   * no value).
   */
  primary: ReactNode
  /**
   * Secondary (bottom) line — a supporting value in small, tertiary text.
   * Omitted entirely when null / undefined / empty string, collapsing the cell
   * to a single line.
   */
  secondary?: ReactNode
  /**
   * Truncate the primary line to a single line with an ellipsis. The secondary
   * line always truncates. Default false — long primary values (names) wrap;
   * set true for long single-token values (UUIDs) that must stay one line.
   */
  truncatePrimary?: boolean
  /**
   * Mark the primary line for marker.io PII masking. The secondary line is
   * never masked — opaque resource ids aren't PII. Only set for primary values
   * that double as personal identifiers (a person's name, an external handle).
   */
  pii?: boolean
  className?: string
  /** Optional. Format: `{feature}-{view}-{element}`. See `.claude/rules/concepts/testid.md`. */
  'data-testid'?: string
}

/**
 * Dumb two-line stacked cell: a prominent primary line over a small, tertiary
 * secondary line. Renders as nested `<span>`s so it's safe to nest inside an
 * `<a>` trigger (block elements there would create invalid HTML). The
 * `group-hover:text-primary` on both lines brightens the whole cell when it's
 * wrapped in a `cellTrigger` (which puts `group` on the `<td>`).
 *
 * This is the layout primitive behind `NameCell` (name over id) and the
 * `idTimestampCell()` factory below (id over timestamp). Reach for those first —
 * they own the value coercion, empty fallback, and date formatting. Use
 * `StackedCell` directly only for a one-off orientation they don't cover.
 *
 * @when A table cell (or detail value) stacking one prominent value over a
 *   supporting one, in a column `cellRender`.
 * @avoid Single-line displays — use plain text, `IdCell`, or `Timestamp`.
 *   Name-first rows — use `NameCell`. Id-over-timestamp rows — use the
 *   `idTimestampCell()` factory below.
 */
export function StackedCell({
  primary,
  secondary,
  truncatePrimary,
  pii,
  className,
  'data-testid': testid,
}: StackedCellProps) {
  return (
    <span className={cn('flex min-w-0 flex-col leading-tight', className)} data-testid={testid}>
      <span
        className={cn(
          'group-hover:text-primary',
          truncatePrimary && 'truncate',
          pii && PII_MASK_CLASS,
        )}
      >
        {primary}
      </span>
      {secondary != null && secondary !== '' && (
        <span className="truncate text-2xs text-fg-tertiary group-hover:text-primary">
          {secondary}
        </span>
      )}
    </span>
  )
}

/**
 * `idTimestampCell()` is incidents-specific (id primary, date secondary).
 *
 * There is no date-primary counterpart: the licenses table used to pair the
 * date over the id, but CX reversed that (CORE-910) — licenses now renders
 * assignee-name over id via `NameCell`, and no table renders a date/id combined
 * cell. So the old id-primary vs date-primary orientation split is resolved by
 * removal, not by picking a winner.
 */

/**
 * `cellRender` factory for the id-over-timestamp column pattern: the row's id
 * as the prominent primary line (truncated — UUIDs are long), a derived
 * timestamp as the secondary line. Use on a column whose field is the row's id:
 *
 *   columns: ColumnSpec<T>[] = [
 *     { field: fields.id, fill: true, label: 'Incident',
 *       cellRender: idTimestampCell((ctx) => ctx.record.created_at) },
 *   ]
 *
 * Pass a `timestamp(ctx)` accessor to pull the datetime off the row (it's
 * rarely the column's own `value`, which is the id). `record.id` is coerced via
 * `String` (empty → `—`); the timestamp via `formatDate` (empty/non-string →
 * single line). The incidents table is the reference consumer (CORE-828).
 */
export function idTimestampCell<T extends { id: unknown }>(
  timestamp: (ctx: RenderCtx<T>) => unknown,
  opts?: { format?: 'long' | 'short'; pii?: boolean },
) {
  return function IdTimestampCellRender({ value, record }: RenderCtx<T>): ReactNode {
    const ts = timestamp({ value, record })
    const tsStr = typeof ts === 'string' && ts !== '' ? formatDate(ts, opts?.format) : undefined
    const idStr = record.id == null ? '' : String(record.id)
    return (
      <StackedCell
        primary={idStr === '' ? '—' : idStr}
        secondary={tsStr}
        truncatePrimary
        pii={opts?.pii}
      />
    )
  }
}
