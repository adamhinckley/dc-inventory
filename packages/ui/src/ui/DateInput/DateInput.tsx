import { useState, type ComponentPropsWithRef } from 'react'
import { Calendar as CalendarIcon } from 'lucide-react'
import { cva, type VariantProps } from 'class-variance-authority'
import { PII_MASK_CLASS } from '#shared/constants/pii-mask'
import { cn } from '#cn'
import { Calendar } from '#ds/ui/Calendar'
import { Popover } from '#ds/ui/Popover'

// Chrome (border, padding, focus ring) lives on the wrapper. Mirrors the
// TextInput chrome so single date pickers visually match plain text
// inputs across the form / filter contexts.
const triggerVariants = cva(
  'inline-flex w-full items-center justify-between gap-tight bg-surface-card text-fg transition-[border-color] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer ' +
    'focus:border-primary focus:outline-none',
  {
    variants: {
      density: {
        comfortable:
          'min-h-(--space-input-height) rounded-interactable border border-border-field px-input-x py-input-y text-input ' +
          'hover:border-border-field-hover ' +
          'data-invalid:border-error',
        compact:
          'rounded-interactable border border-border-field hover:border-border-field-hover px-input-x-compact py-input-y-compact text-body-sm ' +
          'data-invalid:border-error',
      },
    },
    defaultVariants: { density: 'comfortable' },
  },
)

const DISPLAY_FORMATTER = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' })

/** Parse an ISO yyyy-mm-dd string to a Date in local timezone. */
function parseISODate(value: string | null | undefined): Date | null {
  if (!value) return null
  const parts = value.split('-')
  if (parts.length !== 3) return null
  const [y, m, d] = parts.map((p) => Number(p))
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

/** Format a Date to ISO yyyy-mm-dd in local timezone. */
function formatISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Default max when `yearNavigation` is true and `max` is omitted. */
function defaultYearNavigationMaxISO(): string {
  const year = new Date().getFullYear() + 10
  return `${year}-12-31`
}

export interface DateInputProps
  extends
    Omit<ComponentPropsWithRef<'button'>, 'value' | 'onChange' | 'type'>,
    VariantProps<typeof triggerVariants> {
  /** ISO yyyy-mm-dd string. Empty / null means no date selected. */
  value?: string | null
  /** Called with an ISO yyyy-mm-dd string when the user picks a date. */
  onChange?: (value: string) => void
  /** Min selectable date (ISO yyyy-mm-dd). */
  min?: string
  /** Max selectable date (ISO yyyy-mm-dd). */
  max?: string
  /**
   * Swap the calendar's prev/next month arrows for month + year `<select>`
   * dropdowns so the user can jump straight to a far year. When `max` is
   * omitted, defaults to Dec 31 of (today's calendar year + 10). Pair with
   * `min` when the lower bound matters (e.g. birth dates).
   */
  yearNavigation?: boolean
  /** Placeholder shown when no date is selected. Defaults to "Pick a date". */
  placeholder?: string
  /** Standard `data-testid`. Lands on the trigger button. The popover
   *  popup derives `${testid}-popup`. */
  'data-testid'?: string
  /** Marks the trigger as invalid; lands on the button so the
   *  `data-invalid:border-error` CVA variant fires. */
  'data-invalid'?: boolean
  /**
   * When true, marks the displayed date label for marker.io PII masking.
   * Most dates are not PII — apply only for sensitive personal dates
   * (date of birth, anniversary).
   */
  pii?: boolean
}

/**
 * Date picker — a styled trigger button matching the TextInput chrome
 * that opens a Popover with a single-month Calendar. The picker UX
 * replaces the native `<input type="date">` for cross-browser
 * consistency.
 *
 * @when Single date form fields (`Form.DateInput`) and FilterBar single
 *   date editors. Anywhere a user picks one date.
 * @avoid Date ranges — use `DateRangeInput`. Date-time pickers (with
 *   time-of-day) — not yet available; surface as a follow-up.
 */
export function DateInput({
  ref,
  className,
  density,
  value,
  onChange,
  min,
  max,
  yearNavigation,
  placeholder = 'Pick a date',
  disabled,
  pii,
  'data-testid': testid,
  'data-invalid': dataInvalid,
  ...rest
}: DateInputProps) {
  const [open, setOpen] = useState(false)
  const date = parseISODate(value)
  const minDate = parseISODate(min) ?? undefined
  const effectiveMax = max ?? (yearNavigation ? defaultYearNavigationMaxISO() : undefined)
  const maxDate = parseISODate(effectiveMax) ?? undefined
  const displayLabel = date ? DISPLAY_FORMATTER.format(date) : placeholder

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        ref={ref}
        disabled={disabled}
        className={cn(triggerVariants({ density }), className)}
        data-testid={testid}
        data-invalid={dataInvalid}
        {...rest}
      >
        <span className={cn(!date && 'text-fg-tertiary', pii && PII_MASK_CLASS)}>
          {displayLabel}
        </span>
        <CalendarIcon className="size-icon text-fg-tertiary shrink-0" />
      </Popover.Trigger>
      <Popover.Content side="bottom" align="start" className="p-0" data-testid={`${testid}-popup`}>
        <Calendar
          mode="single"
          value={date}
          onChange={(next) => {
            onChange?.(next ? formatISODate(next) : '')
            setOpen(false)
          }}
          fromDate={minDate}
          toDate={maxDate}
          yearNavigation={yearNavigation}
        />
      </Popover.Content>
    </Popover>
  )
}
