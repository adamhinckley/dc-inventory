import type { ReactNode } from 'react'
import { StackedCell } from '#ds/ui/StackedCell'
import type { RenderCtx } from '#shared/resource/types'

interface NameCellProps {
  /** Primary line — the resource's display name. Falsy renders as `—`. */
  name: ReactNode
  /**
   * Secondary line — the resource id, rendered in full. Accepts unknown
   * so callers can pass `record.id` straight through without narrowing.
   */
  id: unknown
  /**
   * When true, marks the name line for marker.io PII masking. The id
   * line is never masked — opaque IDs aren't PII.
   */
  pii?: boolean
  className?: string
  /** Optional. Format: `{feature}-{view}-{element}`. See `.claude/rules/concepts/testid.md`. */
  'data-testid'?: string
}

/**
 * Two-line cell: resource display name on top, full id underneath. Thin
 * semantic wrapper over `StackedCell` — the name is the primary line, the id
 * the secondary line. Safe to nest inside an `<a>` trigger (StackedCell
 * renders `<span>`s).
 *
 * @when Default `name` column renderer for resource tables. Use the
 *   `nameCell()` shorthand from this same file for column overrides.
 * @avoid Single-line displays — use plain text or `text-fg`. Detail-page
 *   headings — use `PageHeader.Title`.
 */
export function NameCell({ name, id, pii, className, 'data-testid': testid }: NameCellProps) {
  const idStr = id == null ? '' : String(id)
  return (
    <StackedCell
      primary={name == null || name === '' ? '—' : name}
      secondary={idStr === '' ? undefined : idStr}
      pii={pii}
      className={className}
      data-testid={testid}
    />
  )
}

/**
 * `cellRender` shorthand for the most common name-column pattern: render
 * the field's value as the primary line, the row's id as the secondary
 * line. Use as `cellRender: nameCell()` on the table's column spec:
 *
 *   columns: ColumnSpec<T>[] = [
 *     { field: fields.name, fill: true, cellRender: nameCell() },
 *   ]
 *
 * Pass `name(record)` to derive the display name from the row when it
 * isn't a single column value (e.g. principals' `full_name` falls back
 * to first + last when the computed value is null).
 */
export function nameCell<T extends { id: unknown }>(name?: (ctx: RenderCtx<T>) => ReactNode) {
  return function NameCellRender({ value, record }: RenderCtx<T>): ReactNode {
    return <NameCell name={name ? name({ value, record }) : (value as ReactNode)} id={record.id} />
  }
}
