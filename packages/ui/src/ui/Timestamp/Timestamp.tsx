import type { ReactNode } from 'react'
import { formatDate, formatTime } from '#shared/utils/format-date'
import type { RenderCtx } from '#shared/resource/types'

interface TimestampProps {
  /**
   * Accepts unknown so callers (especially `FieldConfig.render`) can pass
   * `value` straight through without narrowing. Anything other than a
   * non-empty string renders as null.
   */
  value: unknown
  format?: 'long' | 'short'
  /** When true, render the time-of-day next to the date in a dimmer tone. */
  withTime?: boolean
  /** Optional. Format: `{feature}-{view}-{element}`. See `.claude/rules/concepts/testid.md`. */
  'data-testid'?: string
}

/**
 * Formatted timestamp display. Coerces `value` to a non-empty string and
 * formats via `formatDate`. Renders nothing for empty/non-string input.
 *
 * @when Every column or field showing a date or datetime — `created_at`,
 *   `updated_at`, `last_seen`. Pass `format="short"` for compact cells.
 *   Pass `withTime` to render the time-of-day next to the date.
 * @avoid Computing display strings yourself — pass the raw ISO value here
 *   so all timestamps share formatting.
 */
export function Timestamp({ value, format, withTime, 'data-testid': testid }: TimestampProps) {
  if (typeof value !== 'string' || value === '') return null

  return (
    <span className="section-content-timestamp" data-testid={testid}>
      {formatDate(value, format)}
      {withTime && <span className="ml-1 text-fg-tertiary">{formatTime(value)}</span>}
    </span>
  )
}

/**
 * `render` / `cellRender` factory for the timestamp-column pattern: render the
 * field's value via `Timestamp`. Use as `render: timestampCell()` on a
 * `FieldConfig` or `cellRender: timestampCell()` on a `ColumnSpec`:
 *
 *   created_at: { label: 'Created', render: timestampCell() }
 *   last_seen:  { label: 'Last seen', render: timestampCell({ withTime: true }) }
 *
 * Mirrors `nameCell()` / `idTimestampCell()`. `Timestamp` coerces `value`
 * internally and renders nothing for empty/non-string input.
 */
export function timestampCell<T = unknown>(opts?: {
  format?: 'long' | 'short'
  withTime?: boolean
}) {
  return function TimestampRender({ value }: RenderCtx<T>): ReactNode {
    return <Timestamp value={value} format={opts?.format} withTime={opts?.withTime} />
  }
}
