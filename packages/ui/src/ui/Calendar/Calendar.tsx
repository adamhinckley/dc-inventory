import { useState, type ComponentPropsWithRef } from 'react'
import { DayPicker, type DateRange } from 'react-day-picker'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '#cn'

// react-day-picker v9 ships no default CSS — `classNames` maps internal
// element keys (the `UI` enum) to Tailwind class strings. We style each
// part with our design tokens and archetypes. Selected / today / range
// state classes go via `modifiersClassNames`.
const calendarClassNames = {
  // `relative` anchors the absolutely-positioned `nav` chevrons to each
  // DayPicker instance. Without it, dual-pane range mode renders both
  // navs against the outer wrapper, stacking them on top of each other —
  // only the second pane's arrows end up clickable.
  root: 'p-2 relative',
  months: 'flex flex-col sm:flex-row gap-form-section',
  month: 'flex flex-col gap-tight',
  month_caption: 'flex items-center justify-center pt-tight pb-tight',
  // In dropdown mode rdp renders `{label}<Chevron/>` as siblings inside this
  // span; Preflight's `svg { display: block }` would drop the chevron below
  // the text without a row layout. `inline-flex` is a no-op for the plain
  // arrow-mode title (single text node), so the key stays shared.
  caption_label: 'inline-flex items-center gap-tight text-body-emphasis text-fg',
  nav: 'flex items-center justify-between absolute top-2 inset-x-2',
  button_previous: 'interactable ghost h-7 w-7 inline-flex items-center justify-center disableable',
  button_next: 'interactable ghost h-7 w-7 inline-flex items-center justify-center disableable',
  month_grid: 'w-full border-collapse',
  weekdays: 'flex',
  weekday: 'text-fg-tertiary text-2xs font-medium w-9 text-center',
  week: 'flex w-full mt-1',
  day: 'h-9 w-9 text-center text-xs p-0',
  day_button:
    'interactable ghost h-9 w-9 inline-flex items-center justify-center text-xs disableable cursor-pointer',
  today: 'ring-1 ring-primary ring-inset rounded-interactable',
  disabled: 'opacity-40 pointer-events-none',
  // react-day-picker applies these selection-state classes to the Day CELL
  // (<td>), not the inner DayButton — which carries the `ghost` archetype's
  // color. A color on the cell can't override the button's own color, so target
  // the button via `[&>button]` with `!` (beats ghost in resting + hover).
  //
  // rdp also marks every in-range day as `selected` AND `range_middle`, so both
  // land on the same cell. range_start/range_end share `selected`'s fill so the
  // overlap is harmless, but range_middle differs (tint + dark text) — qualify
  // its button selector (`button.interactable`) to outrank `selected`'s equal-
  // specificity `[&>button]` rule; otherwise white text lands on the tint
  // (1.45:1). The button is already `rounded-interactable`; square the inner
  // edges for the range bar.
  range_start:
    '[&>button]:rounded-r-none [&>button]:bg-primary-strong! [&>button]:text-primary-content!',
  range_end:
    '[&>button]:rounded-l-none [&>button]:bg-primary-strong! [&>button]:text-primary-content!',
  range_middle:
    '[&>button]:rounded-none [&>button.interactable]:bg-range-tint! [&>button.interactable]:text-fg!',
  selected: '[&>button]:bg-primary-strong! [&>button]:text-primary-content!',
  hidden: 'invisible',
  // Dropdown-caption keys (single-mode `captionLayout="dropdown"` only —
  // inert in range mode, which never sets captionLayout). rdp renders each
  // dropdown as `dropdown_root > [<select .dropdown>, <span .caption_label>]`:
  // the native <select> is overlaid transparent for interaction, the
  // caption_label span carries the visible label + chevron.
  dropdowns: 'flex gap-tight items-center justify-center',
  dropdown_root:
    'relative inline-flex items-center gap-tight bg-surface-card border border-border-field ' +
    'rounded-interactable px-input-x-compact py-input-y-compact ' +
    'hover:border-border-field-hover focus-within:border-primary',
  dropdown: 'absolute inset-0 w-full opacity-0 cursor-pointer',
}

// Lucide chevrons honor `currentColor`, so they inherit the
// `text-fg-secondary` / `hover:text-fg` from the `interactable ghost`
// classes on the nav button and adapt to light/dark themes. The
// default react-day-picker chevron does not — without this override
// the arrows render in a hardcoded shade that disappears in dark mode.
const calendarComponents = {
  Chevron: ({ orientation }: { orientation?: 'left' | 'right' | 'up' | 'down' }) =>
    orientation === 'left' ? (
      <ChevronLeft className="size-icon-lg" />
    ) : orientation === 'down' ? (
      <ChevronDown className="size-icon" />
    ) : (
      <ChevronRight className="size-icon-lg" />
    ),
}

type CalendarBaseProps = Omit<ComponentPropsWithRef<'div'>, 'onChange' | 'children'> & {
  /** Min selectable date. */
  fromDate?: Date
  /** Max selectable date. */
  toDate?: Date
  /** Number of months visible. Defaults to 1; range mode looks better with 2. */
  numberOfMonths?: number
  /** Initial month displayed on mount. Use this in 2-month range view
   *  when you want the anchor date (today, or the range's `to`) to land
   *  in the *second* pane — past-leaning date filters belong on the
   *  right with history on the left. Uncontrolled: DayPicker manages
   *  the month internally after mount. */
  defaultMonth?: Date
  /** Whether the calendar is disabled. */
  disabled?: boolean
  /** Single-mode only: swap the prev/next month arrows for month + year
   *  `<select>` dropdowns so the user can jump to a far year (e.g. a birth
   *  date). Pair with `fromDate`/`toDate` — the year list spans those
   *  bounds; unbounded, rdp falls back to an arbitrary ~100-year window.
   *  Ignored in range mode (dropdowns can't drive the two panes
   *  independently). */
  yearNavigation?: boolean
}

export type CalendarProps =
  | (CalendarBaseProps & {
      mode?: 'single'
      value?: Date | null
      onChange?: (next: Date | null) => void
    })
  | (CalendarBaseProps & {
      mode: 'range'
      value?: DateRange
      onChange?: (next: DateRange | undefined) => void
      /** Controlled month for the left pane in range mode. When provided,
       *  pairs with `onLeftMonthChange` so the parent can sync pane
       *  position with external state (preset clicks, typed inputs). */
      leftMonth?: Date
      rightMonth?: Date
      onLeftMonthChange?: (next: Date) => void
      onRightMonthChange?: (next: Date) => void
    })

/**
 * Calendar primitive backed by react-day-picker. Single date or date
 * range selection; styled with our design tokens.
 *
 * @when Inside a Popover triggered by `DateInput` / `DateRangeInput` for
 *   the calendar picker UX. Standalone usage anywhere a visual date /
 *   range picker is needed.
 * @avoid Plain ISO date inputs without a picker — use `DateInput` /
 *   `DateRangeInput` directly (they wrap this primitive). Single-month
 *   view when picking a range — pass `numberOfMonths={2}` for a clearer
 *   range UX.
 */
export function Calendar({
  ref,
  className,
  mode = 'single',
  value,
  onChange,
  fromDate,
  toDate,
  numberOfMonths,
  defaultMonth,
  disabled,
  yearNavigation,
  ...rest
}: CalendarProps) {
  if (mode === 'range') {
    const rangeRest = rest as Omit<
      Extract<CalendarProps, { mode: 'range' }>,
      | 'mode'
      | 'value'
      | 'onChange'
      | 'fromDate'
      | 'toDate'
      | 'numberOfMonths'
      | 'defaultMonth'
      | 'disabled'
      | 'className'
      | 'ref'
    >
    return (
      <RangeCalendar
        ref={ref}
        className={className}
        value={value as DateRange | undefined}
        onChange={onChange as ((next: DateRange | undefined) => void) | undefined}
        navStartMonth={fromDate}
        navEndMonth={toDate}
        defaultMonth={defaultMonth}
        disabled={disabled}
        leftMonth={rangeRest.leftMonth}
        rightMonth={rangeRest.rightMonth}
        onLeftMonthChange={rangeRest.onLeftMonthChange}
        onRightMonthChange={rangeRest.onRightMonthChange}
      />
    )
  }

  return (
    <div ref={ref} className={className} {...rest}>
      <DayPicker
        mode="single"
        selected={(value as Date | null) ?? undefined}
        onSelect={(next) => (onChange as ((n: Date | null) => void) | undefined)?.(next ?? null)}
        startMonth={fromDate}
        endMonth={toDate}
        defaultMonth={defaultMonth}
        captionLayout={yearNavigation ? 'dropdown' : undefined}
        disabled={disabled ? () => true : undefined}
        numberOfMonths={numberOfMonths ?? 1}
        classNames={calendarClassNames}
        showOutsideDays
        components={calendarComponents}
      />
    </div>
  )
}

// ---- range-mode dual-pane implementation ------------------------------
//
// rdp v9 with `numberOfMonths={2}` renders one calendar showing two
// *consecutive* months — both panes are driven by the same internal
// month state, so the dropdowns can't move them independently. To
// let the user pick a range that spans months or years (e.g. Mar 2024
// → Aug 2026) we render two `DayPicker` instances side by side, each
// with its own `month` state but a shared `selected` range. Either
// pane's click goes through the same range handler.

interface RangeCalendarProps extends Omit<ComponentPropsWithRef<'div'>, 'onChange' | 'children'> {
  value: DateRange | undefined
  onChange: ((next: DateRange | undefined) => void) | undefined
  navStartMonth?: Date
  navEndMonth?: Date
  defaultMonth?: Date
  disabled?: boolean
  /** Controlled month for the left pane. When undefined, the pane
   *  manages its own state seeded from `defaultMonth`. */
  leftMonth?: Date
  rightMonth?: Date
  onLeftMonthChange?: (next: Date) => void
  onRightMonthChange?: (next: Date) => void
}

function RangeCalendar({
  ref,
  className,
  value,
  onChange,
  navStartMonth,
  navEndMonth,
  defaultMonth,
  disabled,
  leftMonth: leftMonthProp,
  rightMonth: rightMonthProp,
  onLeftMonthChange,
  onRightMonthChange,
  ...rest
}: RangeCalendarProps) {
  // Initial pane months for the uncontrolled path: left = the anchor's
  // previous month (history on the left), right = the anchor month.
  // Mirrors the past-leaning anchor strategy the picker uses.
  const today = new Date()
  const leftInitial = defaultMonth ?? new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const rightInitial = new Date(leftInitial.getFullYear(), leftInitial.getMonth() + 1, 1)
  const [internalLeftMonth, setInternalLeftMonth] = useState(leftInitial)
  const [internalRightMonth, setInternalRightMonth] = useState(rightInitial)

  // Controlled when a prop is provided; uncontrolled otherwise. The
  // callback fires either way so a parent can observe pane navigation
  // even while letting internal state drive the value.
  const leftMonth = leftMonthProp ?? internalLeftMonth
  const rightMonth = rightMonthProp ?? internalRightMonth
  const handleLeftMonthChange = (next: Date) => {
    if (leftMonthProp === undefined) setInternalLeftMonth(next)
    onLeftMonthChange?.(next)
  }
  const handleRightMonthChange = (next: Date) => {
    if (rightMonthProp === undefined) setInternalRightMonth(next)
    onRightMonthChange?.(next)
  }

  // Each pane owns one side of the range. The clicked day on the left
  // pane updates `from`; the clicked day on the right pane updates
  // `to`. rdp's range-mode auto-extension (first click sets {from:X,
  // to:X}, second click extends) is bypassed by using `triggerDate`
  // — the actual clicked day — instead of rdp's computed range.
  // Keeping `mode="range"` on both panes preserves the cross-pane
  // range visual (range_start / range_middle / range_end styles) from
  // the shared `selected` prop.
  const handleLeftSelect = (_next: DateRange | undefined, triggerDate: Date) => {
    onChange?.({ from: triggerDate, to: value?.to })
  }
  const handleRightSelect = (_next: DateRange | undefined, triggerDate: Date) => {
    onChange?.({ from: value?.from, to: triggerDate })
  }

  const paneProps = {
    mode: 'range' as const,
    selected: value,
    startMonth: navStartMonth,
    endMonth: navEndMonth,
    disabled: disabled ? () => true : undefined,
    numberOfMonths: 1,
    classNames: calendarClassNames,
    components: calendarComponents,
  }

  return (
    <div ref={ref} className={cn('flex', className)} {...rest}>
      <DayPicker
        {...paneProps}
        onSelect={handleLeftSelect}
        month={leftMonth}
        onMonthChange={handleLeftMonthChange}
      />
      <DayPicker
        {...paneProps}
        onSelect={handleRightSelect}
        month={rightMonth}
        onMonthChange={handleRightMonthChange}
      />
    </div>
  )
}
