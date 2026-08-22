// @ts-nocheck
import { useCallback, useEffect, useRef, useState } from 'react'
import type { DateRange } from 'react-day-picker'
import { isDurationString, resolveDurationRange, RELATIVE_PRESETS } from '#shared/utils/duration'
import type { DateRangeValue } from './DateRangeInput'

export function parseISODate(value: string | null | undefined): Date | null {
  if (!value) return null
  const parts = value.split('-')
  if (parts.length !== 3) return null
  const [y, m, d] = parts.map((p) => Number(p))
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

export function formatISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// If the manually picked absolute range matches a preset's resolved range
// *as of now*, return that preset. Lets the picker auto-promote "I picked
// the last 7 days" back to `-P7D` so saved views stay fresh.
export function findMatchingPreset(fromISO: string, toISO: string) {
  const now = new Date()
  for (const preset of RELATIVE_PRESETS) {
    const resolved = resolveDurationRange(preset.value, now)
    if (!resolved) continue
    if (formatISODate(resolved.from) === fromISO && formatISODate(resolved.to) === toISO) {
      return preset
    }
  }
  return null
}

export interface UseDateRangeDraftArgs {
  /** Committed value from the parent. */
  value: DateRangeValue
  /** Popover open state — used to seed the draft on each open transition. */
  open: boolean
  /** Called with the next committed value when Apply fires. */
  onCommit: (next: DateRangeValue) => void
  /** Called to close the popover after Apply / Cancel. */
  onClose: () => void
}

/**
 * Draft state machine for `DateRangeInput`. The popover is a staging
 * surface — nothing reaches `onCommit` until Apply fires. Cancel (or
 * re-pressing the trigger) discards the draft; outside-click and
 * Escape are blocked at the popover level so they don't silently
 * dismiss staged changes. The draft is re-seeded from `value` on each
 * open. Reset clears the draft in place.
 *
 * Apply normalizes the draft before committing: a `from`-only absolute
 * draft fills `to` with today, so "Apr 1 onward" → `{ from: '2026-04-01',
 * to: '<today>' }`. Relative durations (`-P7D`) commit as-is.
 *
 * Calendar picks that exactly match a preset's resolved range auto-promote
 * the draft to the relative duration — so a manually picked "last 7 days"
 * becomes `-P7D` instead of frozen ISO dates.
 */
// Initial month for each calendar pane based on a value. Wide ranges
// (different months) get left=from-month, right=to-month so both
// endpoints are visible. Tight ranges (same month) or empty values get
// the past-leaning default: right pane on the anchor month, left on
// the month before.
function computePaneMonths(v: DateRangeValue): { left: Date; right: Date } {
  const isRel = isDurationString(v.from)
  const resolved = isRel && v.from ? resolveDurationRange(v.from) : null
  const fromD = resolved?.from ?? parseISODate(v.from)
  const toD = resolved?.to ?? parseISODate(v.to)

  const monthStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1)

  if (fromD && toD) {
    const fromMonth = monthStart(fromD)
    const toMonth = monthStart(toD)
    if (fromMonth.getTime() !== toMonth.getTime()) {
      return { left: fromMonth, right: toMonth }
    }
    return {
      left: new Date(toMonth.getFullYear(), toMonth.getMonth() - 1, 1),
      right: toMonth,
    }
  }
  if (fromD) {
    const fromMonth = monthStart(fromD)
    return {
      left: fromMonth,
      right: new Date(fromMonth.getFullYear(), fromMonth.getMonth() + 1, 1),
    }
  }
  if (toD) {
    const toMonth = monthStart(toD)
    return {
      left: new Date(toMonth.getFullYear(), toMonth.getMonth() - 1, 1),
      right: toMonth,
    }
  }
  const today = new Date()
  const todayMonth = monthStart(today)
  return {
    left: new Date(todayMonth.getFullYear(), todayMonth.getMonth() - 1, 1),
    right: todayMonth,
  }
}

export function useDateRangeDraft({ value, open, onCommit, onClose }: UseDateRangeDraftArgs) {
  const [draft, setDraft] = useState<DateRangeValue>(value)
  const initialPanes = computePaneMonths(value)
  const [leftMonth, setLeftMonth] = useState<Date>(initialPanes.left)
  const [rightMonth, setRightMonth] = useState<Date>(initialPanes.right)
  const valueRef = useRef(value)
  // Keep the ref current outside of render so the open-effect below can read
  // the latest value without listing it as a dependency. This effect is
  // ordered before the open-effect, so the ref is up to date when it runs.
  useEffect(() => {
    valueRef.current = value
  })

  // Seed both the draft and the pane months each time the popover
  // transitions to open. While open, external value changes are ignored.
  useEffect(() => {
    if (open) {
      const v = valueRef.current
      setDraft(v)
      const panes = computePaneMonths(v)
      setLeftMonth(panes.left)
      setRightMonth(panes.right)
    }
  }, [open])

  // ---- derived display state -------------------------------------------

  const draftIsRelative = isDurationString(draft.from)
  const resolved = draftIsRelative && draft.from ? resolveDurationRange(draft.from) : null
  // ISO strings consumed by typed inputs and the Calendar. For relative
  // drafts these are the *resolved* dates; for absolute drafts they pass
  // through unchanged.
  const draftFromISO = resolved ? formatISODate(resolved.from) : draft.from
  const draftToISO = resolved ? formatISODate(resolved.to) : draft.to

  const activePreset = draftIsRelative
    ? RELATIVE_PRESETS.find((p) => p.value === draft.from)
    : undefined
  const isCustom = !activePreset

  const fromDate = parseISODate(draftFromISO ?? undefined)
  const toDate = parseISODate(draftToISO ?? undefined)
  const calendarValue: DateRange = {
    from: fromDate ?? undefined,
    to: toDate ?? undefined,
  }

  // Past-leaning anchor: today's month belongs on the right, history on
  // the left. Anchor on the end of the draft (or today if empty).
  const anchor = toDate ?? fromDate ?? new Date()
  const defaultMonth = new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1)

  // ---- validity --------------------------------------------------------

  // Lexicographic compare is safe for ISO yyyy-mm-dd.
  const isInvalid = !!draftFromISO && !!draftToISO && draftFromISO > draftToISO
  // Clearing a previously-set value is itself a meaningful change to
  // commit — Reset stages `{}` and Apply must remain active so the
  // user can commit the clear. When the committed value is already
  // empty, an empty draft is a no-op and Apply stays disabled.
  const isClearChange = !draft.from && !!value.from
  const canApply = isClearChange || (!!draft.from && !isInvalid)

  // ---- staging actions -------------------------------------------------

  // Replace just the start side, dropping any relative-ness — once the
  // user edits an absolute slot the draft is no longer a duration.
  // Also jumps the left pane to the typed month so the calendar
  // follows the input.
  const setDraftFrom = useCallback((iso: string | undefined) => {
    setDraft((prev) => {
      if (isDurationString(prev.from)) {
        const r = resolveDurationRange(prev.from)
        return { from: iso, to: r ? formatISODate(r.to) : undefined }
      }
      return { from: iso, to: prev.to }
    })
    const d = parseISODate(iso)
    if (d) setLeftMonth(new Date(d.getFullYear(), d.getMonth(), 1))
  }, [])

  const setDraftTo = useCallback((iso: string | undefined) => {
    setDraft((prev) => {
      if (isDurationString(prev.from)) {
        const r = resolveDurationRange(prev.from)
        return { from: r ? formatISODate(r.from) : undefined, to: iso }
      }
      return { from: prev.from, to: iso }
    })
    const d = parseISODate(iso)
    if (d) setRightMonth(new Date(d.getFullYear(), d.getMonth(), 1))
  }, [])

  // Calendar clicks leave pane months alone — the user is already
  // viewing the month they clicked from.
  const handleCalendarChange = useCallback((next: DateRange | undefined) => {
    const newFromISO = next?.from ? formatISODate(next.from) : undefined
    const newToISO = next?.to ? formatISODate(next.to) : undefined
    const isCompleteRange = !!next?.from && !!next?.to && next.from.getTime() !== next.to.getTime()

    if (isCompleteRange && newFromISO && newToISO) {
      const match = findMatchingPreset(newFromISO, newToISO)
      if (match) {
        setDraft({ from: match.value, to: undefined })
        return
      }
    }
    setDraft({ from: newFromISO, to: newToISO })
  }, [])

  // Preset click also jumps both panes to the resolved range so the
  // calendar reflects "Last 7/30/60/90 days" visibly, not just in the
  // inputs.
  const handlePreset = useCallback((presetValue: string) => {
    setDraft({ from: presetValue, to: undefined })
    const r = resolveDurationRange(presetValue)
    if (r) {
      setLeftMonth(new Date(r.from.getFullYear(), r.from.getMonth(), 1))
      setRightMonth(new Date(r.to.getFullYear(), r.to.getMonth(), 1))
    }
  }, [])

  // ---- footer actions --------------------------------------------------

  const apply = useCallback(() => {
    let next = draft
    // From-only absolute draft → fill end with today. Relative drafts
    // commit unchanged; the consumer resolves them at request time.
    if (draft.from && !isDurationString(draft.from) && !draft.to) {
      next = { from: draft.from, to: formatISODate(new Date()) }
    }
    onCommit(next)
    onClose()
  }, [draft, onCommit, onClose])

  const cancel = useCallback(() => {
    onClose()
  }, [onClose])

  const reset = useCallback(() => {
    setDraft({})
  }, [])

  return {
    draft,
    draftFromISO,
    draftToISO,
    activePreset,
    isCustom,
    calendarValue,
    defaultMonth,
    leftMonth,
    rightMonth,
    setLeftMonth,
    setRightMonth,
    isInvalid,
    canApply,
    setDraftFrom,
    setDraftTo,
    handleCalendarChange,
    handlePreset,
    apply,
    cancel,
    reset,
  }
}
