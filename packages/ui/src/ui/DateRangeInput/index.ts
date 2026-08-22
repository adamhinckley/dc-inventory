'use client'

/**
 * Date range picker. Single trigger that opens a Popover with a
 * **split layout** — a preset sidebar ("Last 7/30/60/90 days" plus
 * "Custom") next to an always-visible range-mode Calendar. Picking a
 * preset writes an ISO 8601 negative duration into `value.from`
 * (e.g. `-P7D`); picking calendar dates writes ISO `yyyy-mm-dd` to
 * both ends. "Custom" auto-highlights when the value isn't a known
 * preset. The trigger always renders the resolved absolute dates —
 * the sidebar carries the preset name.
 *
 * @when Date range filters in the FilterBar (compact) and date range
 *   form fields (comfortable). Use whenever a saved view or shared
 *   URL should track "last N days" instead of a frozen date range.
 * @avoid Single dates — use `DateInput`. Two unrelated dates (not a
 *   range) — use two `DateInput`s.
 * @variants density (comfortable | compact)
 */
export { DateRangeInput, type DateRangeInputProps, type DateRangeValue } from './DateRangeInput'
export {
  DateRangePanel,
  type DateRangePanelProps,
  type DateRangePanelHandle,
} from './DateRangePanel'
