// @ts-nocheck
'use client'

import { useRef, useState, type ComponentPropsWithRef } from 'react'
import { Calendar as CalendarIcon } from 'lucide-react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '#cn'
import { Popover, type PopoverChangeEventDetails } from '#ds/ui/Popover'
import { isDurationString, resolveDurationRange, RELATIVE_PRESETS } from '#shared/utils/duration'
import { DateRangePanel, type DateRangePanelHandle } from './DateRangePanel'
import { parseISODate } from './DateRangeInput.hook'

// Chrome mirrors `DateInput` so the range trigger reads as a single
// input matching the rest of the form / filter chrome.
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

// Trigger label uses the same MM/DD/YYYY format as the typed inputs
// so the same shape reads consistently across the closed and open
// states of the picker.
function formatTriggerDate(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const y = date.getFullYear()
  return `${m}/${d}/${y}`
}

export interface DateRangeValue {
  /**
   * Start of range. One of:
   * - ISO yyyy-mm-dd (absolute date) — paired with `to` for a closed range
   * - ISO 8601 negative duration (relative range from now), e.g. `-P7D` —
   *   when `from` is a duration, `to` is unset and the component renders
   *   in relative mode. Use `isDurationString()` from
   *   `#shared/utils/duration` to discriminate at consumer call sites.
   */
  from?: string
  /** ISO yyyy-mm-dd end of range. Unset when `from` is a duration. */
  to?: string
}

export interface DateRangeInputProps
  extends
    Omit<ComponentPropsWithRef<'button'>, 'value' | 'onChange' | 'type'>,
    VariantProps<typeof triggerVariants> {
  value: DateRangeValue
  onChange: (next: DateRangeValue) => void
  /** Shared min/max bounds (ISO yyyy-mm-dd) applied to the calendar and
   *  to both typed inputs. */
  min?: string
  max?: string
  placeholder?: string
  /**
   * Render the trailing "active preset" hint slot below the trigger.
   * Default `true`. Set `false` for toolbar / filter rows where the slot
   * — even when invisible — adds vertical space that misaligns the
   * trigger against sibling controls (e.g. `Button` + `TextInput`). The
   * preset hint only surfaces when the committed value is a relative
   * duration; absolute-date filter use cases never display a hint, so
   * the slot is pure layout overhead in that context.
   */
  showHint?: boolean
  /** Standard `data-testid`. Lands on the trigger button. Popup derives
   *  `${testid}-popup`; start/end inputs `${testid}-start-input` /
   *  `${testid}-end-input`; footer buttons `${testid}-reset` /
   *  `${testid}-cancel` / `${testid}-apply`. */
  'data-testid'?: string
  'data-invalid'?: boolean
}

/**
 * Date range picker. Single trigger that opens a Popover wrapping a
 * `DateRangePanel` (preset sidebar + typed start/end inputs + range-mode
 * Calendar + Reset / Cancel / Apply footer). Nothing commits until
 * Apply — the popover is a staging surface. Outside-press and Escape
 * are blocked; they shake the Apply button (via the panel's imperative
 * handle) to teach users that Apply is the save. Cancel (or
 * re-pressing the trigger) is the explicit way to discard the draft.
 *
 * The trigger always renders the **committed** absolute dates — even
 * when the value is a relative duration. The sidebar carries the
 * "which preset" signal; the trigger and calendar render the effective
 * range. A manually picked range matching a preset auto-promotes back
 * to the duration on commit so saved views stay fresh.
 *
 * **Backend translation:** backends do not accept ISO durations.
 * Consumers sending the value to a request layer must resolve duration
 * → absolute first via `resolveDurationRange` from
 * `#shared/utils/duration`.
 *
 * Filter chips that embed the picker inside their own popover should
 * use `DateRangePanel` directly to avoid stacking two popover layers.
 *
 * @when Date range form fields (comfortable density). Pair with an
 *   external `Form.Field` label when a label is required.
 * @avoid Filter chip editors that already provide their own popover —
 *   use `DateRangePanel` directly there.
 */
export function DateRangeInput({
  ref,
  className,
  density,
  value,
  onChange,
  min,
  max,
  placeholder = 'Pick a date range',
  showHint = true,
  disabled,
  'data-testid': testid,
  'data-invalid': dataInvalid,
  ...rest
}: DateRangeInputProps) {
  const [open, setOpen] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const panelRef = useRef<DateRangePanelHandle>(null)

  // Outside-press and Escape are blocked *only when the draft is dirty* —
  // an untouched picker dismisses freely. When blocked, shake the Apply
  // button so users see where the save lives. Dirty state lifts from the
  // panel via `onDirtyChange`; the shake is owned by the panel's
  // imperative handle.
  const handleOpenChange = (nextOpen: boolean, details: PopoverChangeEventDetails) => {
    if (
      !nextOpen &&
      (details.reason === 'outside-press' || details.reason === 'escape-key') &&
      isDirty
    ) {
      details.cancel()
      panelRef.current?.flashApplyButton()
      return
    }
    setOpen(nextOpen)
  }

  // ---- trigger display tracks the committed value, not the draft ------

  const committedIsRelative = isDurationString(value.from)
  const committedResolved =
    committedIsRelative && value.from ? resolveDurationRange(value.from) : null
  const displayFrom = committedResolved?.from ?? parseISODate(value.from)
  const displayTo = committedResolved?.to ?? parseISODate(value.to)

  const hasFrom = !!displayFrom
  const hasTo = !!displayTo
  const isEmpty = !hasFrom && !hasTo

  let displayLabel: string
  if (hasFrom && hasTo) {
    displayLabel = `${formatTriggerDate(displayFrom)} - ${formatTriggerDate(displayTo)}`
  } else if (hasFrom) {
    displayLabel = formatTriggerDate(displayFrom)
  } else if (hasTo) {
    displayLabel = formatTriggerDate(displayTo)
  } else {
    displayLabel = placeholder
  }

  // Helper text surfaces the active *committed* preset name.
  const committedPreset = committedIsRelative
    ? RELATIVE_PRESETS.find((p) => p.value === value.from)
    : null
  const presetHint = committedPreset?.label ?? null

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <div className="flex flex-col gap-tight">
        <Popover.Trigger
          ref={ref}
          disabled={disabled}
          className={cn(triggerVariants({ density }), className)}
          data-testid={testid}
          data-invalid={dataInvalid}
          {...rest}
        >
          <span className={cn(isEmpty && 'text-fg-tertiary')}>{displayLabel}</span>
          <CalendarIcon className="size-icon text-fg-tertiary shrink-0" />
        </Popover.Trigger>
        {/* When `showHint` is true, always render the helper slot so the
            wrapper height is constant regardless of state — Form contexts
            rely on the fixed height to prevent layout jitter. Toolbar
            consumers pass `showHint={false}` to drop the slot entirely. */}
        {showHint ? (
          <span
            className={cn('form-description', !presetHint && 'invisible')}
            data-testid={`${testid}-hint`}
            aria-hidden={!presetHint}
          >
            {presetHint ?? ' '}
          </span>
        ) : null}
      </div>
      <Popover.Content side="bottom" align="start" className="p-0" data-testid={`${testid}-popup`}>
        <DateRangePanel
          ref={panelRef}
          value={value}
          onChange={onChange}
          onClose={() => setOpen(false)}
          onDirtyChange={setIsDirty}
          min={min}
          max={max}
          data-testid={testid}
        />
      </Popover.Content>
    </Popover>
  )
}
