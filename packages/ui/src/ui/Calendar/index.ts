'use client'

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
 * @variants mode (single | range), numberOfMonths
 */
export { Calendar, type CalendarProps } from './Calendar'
