// @ts-nocheck
import { CheckCircle2, XCircle } from 'lucide-react'
import { Chip } from '#ds/ui/Chip'
import type { FieldInput } from '#shared/resource/types'

interface ActiveStatusChipProps {
  active: boolean
  /** Optional. Format: `{feature}-{view}-{element}`. See `.claude/rules/concepts/testid.md`. */
  'data-testid'?: string
}

/**
 * Active/Inactive status chip. Wraps `Chip` with a check/x glyph and the
 * success/error tint based on the boolean `active` flag.
 *
 * The glyph is the disambiguator — color alone (green vs red) is not legible
 * for users with red-green color blindness, so the icon shape carries the
 * state independently of color.
 *
 * @when Boolean activation status (account, source, license, integration).
 * @avoid Multi-state status (Open/Cleared/Snoozed) — render `Chip` directly
 *   and CVA over the status enum.
 */
export function ActiveStatusChip({ active, 'data-testid': testid }: ActiveStatusChipProps) {
  return (
    <Chip
      icon={
        active ? <CheckCircle2 className="size-icon-sm" /> : <XCircle className="size-icon-sm" />
      }
      data-testid={testid}
      style={
        {
          '--chip-color': active ? 'var(--color-success)' : 'var(--color-error)',
        } as React.CSSProperties
      }
    >
      {active ? 'Active' : 'Inactive'}
    </Chip>
  )
}

/**
 * The standard `active` field-map entry: `ActiveStatusChip` render, a
 * labeled true/false select filter (string values — they round-trip through
 * the URL; `toCubeClauses` coerces them back to booleans for the cube), and
 * a boolean-valued select form slot. Like `nameCell()`, a runtime mapper
 * colocated with the component it renders.
 *
 *   active: activeStatusField(),
 *   // diverge by spreading:
 *   active: { ...activeStatusField(), form: undefined },
 */
export function activeStatusField<T>(): FieldInput<T> {
  return {
    label: 'Status',
    render: ({ value }) => <ActiveStatusChip active={Boolean(value)} />,
    filter: {
      kind: 'select',
      options: [
        { value: 'true', label: 'Active' },
        { value: 'false', label: 'Inactive' },
      ],
    },
    form: {
      kind: 'select',
      options: [
        { value: true, label: 'Active' },
        { value: false, label: 'Inactive' },
      ],
    },
  }
}
