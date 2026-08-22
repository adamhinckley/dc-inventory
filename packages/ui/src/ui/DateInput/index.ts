'use client'

/**
 * Date picker — a styled trigger button matching the TextInput chrome
 * that opens a Popover containing a single-month `Calendar`. Replaces
 * the native `<input type="date">` for cross-browser consistency.
 *
 * @when Single date form fields (`Form.DateInput`) and FilterBar single
 *   date editors.
 * @avoid Date ranges — use `DateRangeInput`. Date-time pickers (with
 *   time-of-day) — not yet available; surface as a follow-up.
 * @variants density (comfortable | compact)
 */
export { DateInput, type DateInputProps } from './DateInput'
