import type { ReactNode } from 'react'
import { CopyableText } from '#ds/ui/Copyable'
import type { RenderCtx } from '#shared/resource/types'

interface IdCellProps {
  /**
   * Accepts unknown so callers (especially `FieldConfig.render`) can pass
   * `value` straight through without narrowing. Non-string values are
   * coerced via `String()`. Null/undefined renders as null.
   */
  value: unknown
  /**
   * When true, marks the rendered id label for marker.io PII masking.
   * Opaque resource UUIDs aren't PII — only set this for id-shaped values
   * that double as personal identifiers (e.g. external account handles).
   */
  pii?: boolean
  /** Optional. Format: `{feature}-{view}-{element}`. See `.claude/rules/concepts/testid.md`. */
  'data-testid'?: string
}

/**
 * Opaque resource id display with copy-to-clipboard. Renders the full id
 * via `CopyableText`.
 *
 * @when Every resource's `id` field — table cells, detail panels.
 * @avoid Truncating UUIDs to "first 8 chars" — `CopyableText` handles the
 *   space and the user can copy the full value.
 */
export function IdCell({ value, pii, 'data-testid': testid }: IdCellProps) {
  if (value == null) return null
  const str = String(value)
  if (str === '') return null
  return (
    <CopyableText value={str} pii={pii} data-testid={testid ?? `id-cell-${str}`}>
      {str}
    </CopyableText>
  )
}

/**
 * `render` / `cellRender` factory for the id-column pattern: render the
 * field's value via `IdCell` (full id + copy-to-clipboard). Use as
 * `render: idCell()` on a `FieldConfig` or `cellRender: idCell()` on a
 * `ColumnSpec`:
 *
 *   id: { label: 'Account ID', render: idCell() }
 *
 * Mirrors `nameCell()` / `idTimestampCell()`. `IdCell` coerces `value`
 * internally, so no per-call `as string` cast is needed.
 */
export function idCell<T = unknown>(opts?: { pii?: boolean }) {
  return function IdCellRender({ value }: RenderCtx<T>): ReactNode {
    return <IdCell value={value} pii={opts?.pii} />
  }
}
