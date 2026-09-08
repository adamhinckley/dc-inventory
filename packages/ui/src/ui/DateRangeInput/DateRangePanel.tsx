// @ts-nocheck
import { useEffect, useImperativeHandle, useRef, useState, type ChangeEvent, type Ref } from 'react'
// React Compiler can elide render-time ref mutations and may not honor
// useImperativeHandle deps in edge cases. Dirty state therefore lifts to
// the parent via `onDirtyChange` (a plain callback) instead of routing
// through the imperative handle.
import { Check as CheckIcon } from 'lucide-react'
import { cn } from '#cn'
import { Calendar } from '#ds/ui/Calendar'
import { Button } from '#ds/ui/Button'
import { RELATIVE_PRESETS } from '#shared/utils/duration'
import type { DateRangeValue } from './DateRangeInput'
import { parseISODate, useDateRangeDraft } from './DateRangeInput.hook'

// Typed-input chrome — same tokens as DateInput's wrapper, applied
// directly to a native `<input>` so the browser handles keyboard nav.
const dateInputClass =
  'w-full rounded-interactable border border-border-field bg-surface-card px-input-x py-input-y text-input text-fg ' +
  'hover:border-border-field-hover focus:border-primary focus:outline-none ' +
  'data-invalid:border-error transition-[border-color]'

const presetTestidSuffix = (value: string) => value.replace(/^-/, '').toLowerCase()

export interface DateRangePanelHandle {
  /**
   * Play the Apply button shake animation. Surfaces a "save lives here"
   * signal — call this when a wrapping popover blocks an outside-press
   * close that would otherwise discard the staged draft.
   */
  flashApplyButton: () => void
}

export interface DateRangePanelProps {
  value: DateRangeValue
  /** Called when the user clicks Apply. The staged draft is normalized
   *  (a from-only absolute draft fills `to` with today). */
  onChange: (next: DateRangeValue) => void
  /** Called when the panel self-dismisses (Apply or Cancel). The parent
   *  surface — chip popover, drawer, form dialog — closes here. */
  onClose: () => void
  /** Shared min/max bounds (ISO yyyy-mm-dd) applied to the calendar and
   *  to both typed inputs. */
  min?: string
  max?: string
  /**
   * Relative lookback presets (Last 7 / 30 days). Default `true` for
   * filter ranges. Set `false` when picking future dates — those
   * presets are the past.
   */
  showPresets?: boolean
  /** Standard `data-testid`. Lands on the panel wrapper; sidebar presets
   *  derive `${testid}-preset-{name}`; start/end inputs derive
   *  `${testid}-start-input` / `${testid}-end-input`; footer buttons
   *  `${testid}-reset` / `${testid}-cancel` / `${testid}-apply`. */
  'data-testid'?: string
  /** Notified whenever the staged draft transitions between equal-to-value
   *  (`false`) and diverged-from-value (`true`). Parents use this to gate
   *  outside-press blocking — an untouched picker dismisses freely; a
   *  dirty picker stays open and shakes the Apply button. */
  onDirtyChange?: (dirty: boolean) => void
  /** Imperative handle exposing `flashApplyButton()`. */
  ref?: Ref<DateRangePanelHandle>
}

/**
 * Date range picker panel: preset sidebar, masked typed inputs, a
 * range-mode Calendar, and a Reset / Cancel / Apply footer. The
 * draft state is staged until Apply — `onChange` fires only on commit;
 * `onClose` fires on both Apply and Cancel so the parent can dismiss.
 *
 * No popover wrapper of its own — the parent surface owns the popover
 * (or other dismissable container) and any outside-press / Escape
 * handling. Wrappers should call `flashApplyButton()` via the
 * imperative `ref` handle when blocking an outside-press close so the
 * shake animation surfaces the save target.
 *
 * Apply normalizes the draft: a from-only absolute draft fills `to`
 * with today, so "from Apr 1 onward" stores `{ from: '2026-04-01',
 * to: '<today>' }`. Relative durations (`-P7D`) commit unchanged.
 *
 * **Backend translation:** backends do not accept ISO durations.
 * Consumers sending the value to a request layer must resolve duration
 * → absolute first via `resolveDurationRange` from
 * `#shared/utils/duration`.
 *
 * @when Inside a popover or other dismissable container that owns
 *   open/close — filter chip popovers, form dialogs.
 * @avoid Using directly in page flow without a wrapping container —
 *   the panel has no dismissal UI of its own beyond Apply / Cancel,
 *   and `onClose` needs *something* to dismiss.
 */
export function DateRangePanel({
  ref,
  value,
  onChange,
  onClose,
  min,
  max,
  showPresets = true,
  onDirtyChange,
  'data-testid': testid,
}: DateRangePanelProps) {
  const applyButtonRef = useRef<HTMLButtonElement>(null)

  // The hook keys its draft-seed effect on the `open` flag — the panel
  // is always visible, so `open` is permanently true and the effect
  // runs once on mount.
  const {
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
  } = useDateRangeDraft({
    value,
    open: true,
    onCommit: onChange,
    onClose,
  })

  // The draft starts equal to `value` on mount; any user edit (preset
  // click, calendar click, typed input) diverges it. Push dirty changes
  // to the parent via callback so the parent can gate its close-blocking
  // — an untouched picker dismisses freely.
  const isDirty =
    (draft.from ?? null) !== (value.from ?? null) || (draft.to ?? null) !== (value.to ?? null)
  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  // Shake the Apply button on demand. WAAPI re-triggers cleanly on
  // repeated invocations; CSS class-toggling does not.
  useImperativeHandle(
    ref,
    (): DateRangePanelHandle => ({
      flashApplyButton: () => {
        const el = applyButtonRef.current
        // jsdom doesn't implement Element.animate — guarding here keeps
        // the dirty-gate close-blocking testable without stubbing WAAPI.
        if (!el || typeof el.animate !== 'function') return
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
        el.animate(
          [
            { transform: 'translateX(0)' },
            { transform: 'translateX(-4px)' },
            { transform: 'translateX(4px)' },
            { transform: 'translateX(-3px)' },
            { transform: 'translateX(3px)' },
            { transform: 'translateX(0)' },
          ],
          { duration: 380, easing: 'ease-in-out' },
        )
      },
    }),
    [],
  )

  const minDate = parseISODate(min) ?? undefined
  const maxDate = parseISODate(max) ?? undefined

  return (
    <div className="flex flex-col" data-testid={`${testid}-panel`}>
      <div className="flex">
        {showPresets ? (
          <PresetSidebar
            activeValue={activePreset?.value}
            isCustom={isCustom}
            onPreset={handlePreset}
            testid={testid}
          />
        ) : null}
        <div className="flex flex-col">
          <div className="flex gap-tight px-2 pt-2">
            <div className="flex flex-1 flex-col gap-tight">
              <label className="form-label" htmlFor={`${testid}-start-input`}>
                Start
              </label>
              <MaskedDateInput
                id={`${testid}-start-input`}
                valueISO={draftFromISO}
                onChangeISO={setDraftFrom}
                testid={`${testid}-start-input`}
              />
            </div>
            <div className="flex flex-1 flex-col gap-tight">
              <label className="form-label" htmlFor={`${testid}-end-input`}>
                End
              </label>
              <MaskedDateInput
                id={`${testid}-end-input`}
                valueISO={draftToISO}
                onChangeISO={setDraftTo}
                invalid={isInvalid}
                testid={`${testid}-end-input`}
              />
            </div>
          </div>
          <Calendar
            mode="range"
            className="relative"
            value={calendarValue}
            onChange={handleCalendarChange}
            fromDate={minDate}
            toDate={maxDate}
            defaultMonth={defaultMonth}
            leftMonth={leftMonth}
            rightMonth={rightMonth}
            onLeftMonthChange={setLeftMonth}
            onRightMonthChange={setRightMonth}
          />
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-border px-2 py-2">
        <Button variant="ghost" size="sm" onClick={reset} data-testid={`${testid}-reset`}>
          Reset
        </Button>
        <div className="flex gap-action">
          <Button variant="ghost" size="sm" onClick={cancel} data-testid={`${testid}-cancel`}>
            Cancel
          </Button>
          <Button
            ref={applyButtonRef}
            variant="primary"
            size="sm"
            onClick={apply}
            disabled={!canApply}
            data-testid={`${testid}-apply`}
          >
            Apply
          </Button>
        </div>
      </div>
    </div>
  )
}

// ---- preset sidebar ---------------------------------------------------

function PresetSidebar({
  activeValue,
  isCustom,
  onPreset,
  testid,
}: {
  activeValue: string | undefined
  isCustom: boolean
  onPreset: (value: string) => void
  testid?: string
}) {
  return (
    <div className="flex w-40 flex-col gap-tight border-r border-border py-2 pr-1 pl-1">
      {RELATIVE_PRESETS.map((preset) => {
        const isActive = preset.value === activeValue
        return (
          <button
            key={preset.value}
            type="button"
            onClick={() => onPreset(preset.value)}
            data-testid={`${testid}-preset-${presetTestidSuffix(preset.value)}`}
            className={cn(
              'interactable ghost item-padding flex w-full items-center justify-between text-left',
              isActive && 'text-fg font-medium',
            )}
          >
            <span>{preset.label}</span>
            {isActive ? <CheckIcon className="size-icon text-primary" /> : null}
          </button>
        )
      })}
      {/* Custom is a non-interactive indicator — auto-highlights when no
          preset matches the draft. The typed inputs and calendar are the
          actual "custom mode" UI. */}
      <div
        data-testid={`${testid}-preset-custom`}
        className={cn(
          'item-padding flex w-full items-center justify-between text-left text-fg-secondary',
          isCustom && 'text-fg font-medium',
        )}
      >
        <span>Custom</span>
        {isCustom ? <CheckIcon className="size-icon text-primary" /> : null}
      </div>
    </div>
  )
}

// ---- masked typed input -----------------------------------------------
//
// Native `<input type="date">` opens a second calendar (the browser's
// own) on click and renders inconsistently across browsers (Firefox
// text-y, Safari button, Chrome digit-slots). We provide our own
// Calendar above, so the typed input here is a controlled text field
// with manual MM/DD/YYYY masking — no native picker, same chrome.

function isoToDisplay(iso: string | null | undefined): string {
  if (!iso) return ''
  const parts = iso.split('-')
  if (parts.length !== 3) return ''
  const [y, m, d] = parts
  return `${m}/${d}/${y}`
}

// Accepts MM/DD/YYYY (with sane month/day ranges). Returns ISO yyyy-mm-dd
// or undefined for partial / out-of-range input.
function displayToISO(display: string): string | undefined {
  const m = display.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return undefined
  const [, mm, dd, yyyy] = m
  const month = Number(mm)
  const day = Number(dd)
  const year = Number(yyyy)
  if (month < 1 || month > 12) return undefined
  if (day < 1 || day > 31) return undefined
  if (year < 1) return undefined
  return `${yyyy}-${mm}-${dd}`
}

// Strip non-digits, cap at 8 digits, re-insert slashes at the MM/DD
// boundaries as the user types. Backspace works naturally — once the
// digit before a slash is removed the slash drops off the next render.
function applyMask(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

interface MaskedDateInputProps {
  id: string
  valueISO: string | null | undefined
  onChangeISO: (next: string | undefined) => void
  invalid?: boolean
  testid?: string
}

// After re-masking on input, the caret should land at the same *digit
// boundary* the user was at — not jumped to the end of the field by
// React's default value-reset. Translates a "N digits to the left"
// position into a character offset in the masked output.
function caretAfterNDigits(masked: string, n: number): number {
  let count = 0
  for (let i = 0; i < masked.length; i++) {
    if (count === n) return i
    if (/\d/.test(masked[i])) count++
  }
  return masked.length
}

function MaskedDateInput({ id, valueISO, onChangeISO, invalid, testid }: MaskedDateInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState(() => isoToDisplay(valueISO))
  const [focused, setFocused] = useState(false)
  const [prevValueISO, setPrevValueISO] = useState(valueISO)
  // Set by handleChange whenever the user edits; consumed by the
  // post-render effect to restore the caret. Non-user-driven text
  // changes (external ISO sync, blur snap-back) leave this null.
  const pendingCaretRef = useRef<number | null>(null)

  useEffect(() => {
    if (pendingCaretRef.current !== null && inputRef.current) {
      const pos = pendingCaretRef.current
      inputRef.current.setSelectionRange(pos, pos)
      pendingCaretRef.current = null
    }
  })

  // Sync display from external ISO (calendar/preset/reset) at render time —
  // the React-sanctioned "adjust state when a prop changes" pattern. Skipped
  // while focused so mid-type partial text isn't clobbered; the snap-back on
  // blur (handleBlur) picks up any external change that landed while focused.
  if (valueISO !== prevValueISO) {
    setPrevValueISO(valueISO)
    if (!focused) setText(isoToDisplay(valueISO))
  }

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value
    const rawCaret = e.target.selectionStart ?? rawValue.length
    const digitsBeforeCaret = rawValue.slice(0, rawCaret).replace(/\D/g, '').length

    const next = applyMask(rawValue)
    pendingCaretRef.current = caretAfterNDigits(next, digitsBeforeCaret)
    setText(next)

    if (next === '') {
      onChangeISO(undefined)
      return
    }
    const iso = displayToISO(next)
    if (iso) onChangeISO(iso)
  }

  const handleBlur = () => {
    setFocused(false)
    // Snap the display back to the current ISO's canonical form. For valid
    // typed text this is a no-op (onChangeISO already propagated it); for
    // partial/invalid text it restores a complete value; and it picks up any
    // external ISO change that arrived while the field was focused.
    setText(isoToDisplay(valueISO))
  }

  return (
    <input
      ref={inputRef}
      id={id}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder="mm/dd/yyyy"
      value={text}
      onChange={handleChange}
      onFocus={() => setFocused(true)}
      onBlur={handleBlur}
      data-invalid={invalid || undefined}
      data-testid={testid}
      className={dateInputClass}
    />
  )
}
