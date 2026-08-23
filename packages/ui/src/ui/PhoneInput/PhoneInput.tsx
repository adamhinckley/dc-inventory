import { useEffect, useRef, useState, type ComponentPropsWithRef, type Ref } from 'react'
import { Combobox as BaseCombobox } from '@base-ui-components/react/combobox'
import { Check, ChevronDown, Search } from 'lucide-react'
import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js'
import { cva, type VariantProps } from 'class-variance-authority'
import { CountryFlag } from '#ds/ui/CountryFlag'
import { PII_MASK_CLASS } from '#shared/constants/pii-mask'
import { cn } from '#cn'

// Region display names for country labels (`'US'` → "United States").
// Module-level: built once, not per render. `type: 'region'` is ISO 3166-1.
const REGION_NAMES = new Intl.DisplayNames(['en'], { type: 'region' })

interface CountryEntry {
  code: CountryCode
  name: string
  /** Dial code without the `+` (e.g. `'1'`, `'44'`). */
  callingCode: string
}

// The selectable country list is derived once from libphonenumber-js's
// `getCountries()` (the phone-capable set, ~245) and sorted by name. The FLAG
// asset set is broader (full ISO, vendored by `scripts/vendor-flags.ts`) so
// `CountryFlag` stays reusable elsewhere — the two are intentionally decoupled.
const ALL_COUNTRIES: CountryEntry[] = getCountries()
  .map((code) => ({
    code,
    name: REGION_NAMES.of(code) ?? code,
    callingCode: getCountryCallingCode(code),
  }))
  .sort((a, b) => a.name.localeCompare(b.name))

const BY_CODE = new Map(ALL_COUNTRIES.map((c) => [c.code, c]))

/** Pin `priority` codes atop the name-sorted list (US-first by default). */
function orderCountries(priority: CountryCode[]): CountryEntry[] {
  const pinned = priority.map((code) => BY_CODE.get(code)).filter(Boolean) as CountryEntry[]
  const pinnedCodes = new Set(pinned.map((c) => c.code))
  return [...pinned, ...ALL_COUNTRIES.filter((c) => !pinnedCodes.has(c.code))]
}

function entryFor(code: CountryCode): CountryEntry {
  return (
    BY_CODE.get(code) ?? {
      code,
      name: REGION_NAMES.of(code) ?? code,
      callingCode: getCountryCallingCode(code),
    }
  )
}

// One-time flag cache-warm. The dropdown mounts a flag `<img>` for every country
// at once, so on a cold cache the first open streams ~245 SVGs in visibly. Firing
// the fetches on the first hint of intent (trigger hover/focus) lands them in the
// browser's HTTP cache before the popup opens; every open after that was already
// instant (static same-origin SVGs stay cached). `new Image()` warms the same
// cache the `<img>` reads from without mounting anything. Runs once per page
// (module guard) — the code set is fixed and the browser dedupes repeats anyway.
// Path mirrors `CountryFlag`'s `/flags/{code}.svg` scheme; if that drifts, the
// warm silently no-ops and we fall back to the (harmless) lazy pop-in.
let flagsPrefetched = false
function prefetchFlags() {
  if (flagsPrefetched || typeof window === 'undefined') return
  flagsPrefetched = true
  for (const { code } of ALL_COUNTRIES) {
    new Image().src = `/flags/${code.toLowerCase()}.svg`
  }
}

/**
 * Derive selector + field state from an E.164 value. The round-trip is lossy
 * for shared calling codes (`+1`, `+44`, `+7` re-hydrate to whichever country
 * the parser infers) — the value stays correct, only the displayed flag on
 * edit may differ. Accepted: the backend stores E.164 for phone with no
 * country to preserve the original selection against (plan §3).
 */
function hydrate(value: string, fallback: CountryCode): { country: CountryCode; national: string } {
  if (value) {
    // Non-throwing parser: `undefined` for unparseable / partial input.
    const parsed = parsePhoneNumberFromString(value)
    if (parsed?.country) {
      return {
        country: parsed.country,
        national: new AsYouType(parsed.country).input(parsed.nationalNumber),
      }
    }
    // Unparseable / partial (a malformed legacy value like `+1512`): surface
    // the raw digits under the fallback country so the field shows something
    // editable. Blanking it would hide junk the user needs to fix while form
    // state silently kept it, and submit would persist it untouched.
    return { country: fallback, national: new AsYouType(fallback).input(value.replace(/^\+/, '')) }
  }
  return { country: fallback, national: '' }
}

// Shared bordered surface — mirrors TextInput's chrome so a phone field aligns
// with sibling inputs. No horizontal padding here: the country trigger and the
// national `<input>` own their own padding and share the `focus-within` border.
const wrapperVariants = cva(
  'inline-flex w-full items-center bg-surface-card text-fg transition-[border-color] focus-within:border-primary ' +
    'data-disabled:cursor-not-allowed data-disabled:opacity-60',
  {
    variants: {
      density: {
        // Typography lives on the leaf trigger + input, not this container.
        comfortable:
          'min-h-(--space-input-height) rounded-interactable border border-border-field ' +
          'hover:border-border-field-hover data-invalid:border-error',
        compact:
          'rounded-interactable border border-border-field hover:border-border-field-hover ' +
          'data-invalid:border-error',
      },
    },
    defaultVariants: { density: 'comfortable' },
  },
)

// Country trigger: flush-left, full-height, divided from the number field.
const triggerVariants = cva(
  'flex shrink-0 items-center gap-tight self-stretch rounded-l-interactable border-r border-border-field text-fg ' +
    'transition-colors hover:bg-interactive-hover focus-visible:bg-interactive-hover focus:outline-none ' +
    'data-popup-open:bg-interactive-hover disabled:pointer-events-none',
  {
    variants: {
      density: {
        comfortable: 'px-input-x text-input',
        compact: 'px-input-x-compact text-body-sm',
      },
    },
    defaultVariants: { density: 'comfortable' },
  },
)

const inputVariants = cva(
  'min-w-0 flex-1 bg-transparent text-fg outline-none placeholder:text-fg-muted disabled:cursor-not-allowed',
  {
    variants: {
      density: {
        comfortable: 'px-input-x py-input-y text-input',
        compact: 'px-input-x-compact py-input-y-compact text-body-sm',
      },
    },
    defaultVariants: { density: 'comfortable' },
  },
)

// Option-row chrome — matches Combobox's option styling for consistency.
const optionItemClass =
  'stacked interactable ghost item-padding flex w-full items-center gap-icon text-xs ' +
  'data-highlighted:bg-interactive-strong data-selected:font-medium'

export interface PhoneInputProps extends VariantProps<typeof wrapperVariants> {
  /** E.164 string (`+15551234567`) or `''` when empty. Controlled. */
  value: string
  /** Receives the recomputed E.164 string (`''` when the field can't form one). */
  onChange: (e164: string) => void
  /** Country selected before the user picks one. Default `'US'`. */
  defaultCountry?: CountryCode
  /** Codes pinned atop the country list. Default `['US']` (legacy US-first). */
  priorityCountries?: CountryCode[]
  /** Placeholder for the national-number field. */
  placeholder?: string
  disabled?: boolean
  /** Marks the wrapper invalid so the `data-invalid:border-error` chrome fires. */
  'data-invalid'?: boolean
  /**
   * marker.io PII masking on the whole control (number + selection). Defaults
   * to `true` — phone numbers are PII.
   */
  pii?: boolean
  /**
   * Required. Format: `{feature}-{view}-{element}`. Lands on the national
   * `<input>`; the country trigger derives `${testid}-country-trigger` and
   * option rows derive `${testid}-country-option-${code}`.
   */
  'data-testid'?: string
  name?: string
  id?: string
  onBlur?: ComponentPropsWithRef<'input'>['onBlur']
  className?: string
  /** Points at the national-number `<input>`. */
  ref?: Ref<HTMLInputElement>
}

/**
 * International phone input: a country/dial-code selector fused to a national
 * number field on one bordered surface. The value round-trips as an E.164
 * string (`+15551234567`) through `libphonenumber-js` — `AsYouType` formats
 * the national number as typed, the selected country supplies the calling
 * code. Flags are real self-hosted vector art (`CountryFlag`), never emoji or
 * a CDN.
 *
 * Bare and controlled (value-in / onChange-out). Inside a `<Form>`, use
 * `Form.PhoneInput` (`kind: 'phone'`) — the RHF wrapper that forwards
 * `data-invalid` from field error state.
 *
 * @when Collecting a phone number anywhere international numbers are valid —
 *   the onboarding PII form, contact details, verification.
 * @avoid A plain national-only text field where the country is fixed and
 *   implicit — use `TextInput type="tel"`.
 */
export function PhoneInput({
  value,
  onChange,
  defaultCountry = 'US',
  priorityCountries = ['US'],
  density,
  placeholder,
  disabled,
  pii = true,
  name,
  id,
  onBlur,
  className,
  ref,
  'data-testid': testid,
  'data-invalid': dataInvalid,
}: PhoneInputProps) {
  // Lazy initializers so the mount-time `parsePhoneNumber` runs once, not on
  // every render (its result only seeds state).
  const [country, setCountry] = useState<CountryCode>(() => hydrate(value, defaultCountry).country)
  const [national, setNational] = useState(() => hydrate(value, defaultCountry).national)
  // The last E.164 we emitted — lets the hydrate effect ignore our own writes
  // and re-parse only genuinely external value changes (reset, prefill).
  const lastEmitted = useRef(value)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (value === lastEmitted.current) return
    const next = hydrate(value, country)
    setCountry(next.country)
    setNational(next.national)
    lastEmitted.current = value
    // `country` is a fallback only; re-running on every country change would
    // fight the user's own edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const selected = entryFor(country)
  const countries = orderCountries(priorityCountries)

  // Recompute the formatted national display + E.164 from (country, raw digits)
  // and emit. `AsYouType` is stateful per instance, so build a fresh one and
  // feed it the whole string (the documented reset pattern).
  function emit(nextCountry: CountryCode, raw: string) {
    const ayt = new AsYouType(nextCountry)
    const formatted = ayt.input(raw)
    setNational(formatted)
    // Pasting/typing a full `+CC…` number puts AsYouType into international
    // mode: it formats the foreign number correctly while the trigger still
    // shows the old flag. Sync the flag to whatever country the parser can
    // resolve — but only when it's sure. Shared calling codes (`+1`, `+44`)
    // leave `country` undefined until later digits disambiguate, so the flag
    // holds rather than flipping on a guess and fighting the user's choice.
    const resolved = ayt.getNumber()?.country
    if (resolved && resolved !== nextCountry) setCountry(resolved)
    const e164 = ayt.getNumber()?.number ?? ''
    lastEmitted.current = e164
    onChange(e164)
  }

  function handleCountry(entry: CountryEntry | null) {
    if (!entry) return
    setCountry(entry.code)
    // Keep the national digits, recompute E.164 under the new calling code.
    emit(entry.code, national)
  }

  return (
    <BaseCombobox.Root
      items={countries}
      value={selected}
      onValueChange={handleCountry as never}
      itemToStringValue={(c: CountryEntry) => c.code}
      itemToStringLabel={(c: CountryEntry) => `${c.name} +${c.callingCode}`}
      isItemEqualToValue={((a: CountryEntry, b: CountryEntry) => a.code === b.code) as never}
      disabled={disabled}
    >
      <div
        ref={wrapperRef}
        className={cn(wrapperVariants({ density }), pii && PII_MASK_CLASS, className)}
        data-invalid={dataInvalid || undefined}
        data-disabled={disabled || undefined}
      >
        <BaseCombobox.Trigger
          className={triggerVariants({ density })}
          disabled={disabled}
          data-testid={`${testid}-country-trigger`}
          aria-label={`Country: ${selected.name} (+${selected.callingCode})`}
          // Warm the flag cache on the first sign the user is heading for the
          // country list, so its ~245 flags are cached before the popup opens.
          onMouseEnter={prefetchFlags}
          onFocus={prefetchFlags}
        >
          <CountryFlag code={selected.code} decorative size={18} />
          <span>+{selected.callingCode}</span>
          <BaseCombobox.Icon>
            <ChevronDown className="size-icon text-fg-tertiary" />
          </BaseCombobox.Icon>
        </BaseCombobox.Trigger>
        <input
          ref={ref}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          name={name}
          id={id}
          value={national}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => emit(country, e.target.value)}
          onBlur={onBlur}
          className={inputVariants({ density })}
          data-invalid={dataInvalid || undefined}
          data-testid={testid}
        />
      </div>
      <BaseCombobox.Portal>
        <BaseCombobox.Positioner
          anchor={wrapperRef}
          className="z-popover"
          side="bottom"
          align="start"
          sideOffset={4}
        >
          <BaseCombobox.Popup
            className={cn(
              'overlay rounded-interactable shadow-overlay flex max-h-80 min-w-(--anchor-width) flex-col',
              pii && PII_MASK_CLASS,
            )}
          >
            <div className="border-b border-border-field p-2">
              <div className="flex items-center gap-icon rounded-interactable border border-border-field bg-surface-card px-input-x py-input-y-compact">
                <Search className="size-icon shrink-0 text-fg-tertiary" aria-hidden />
                <BaseCombobox.Input
                  placeholder="Search countries"
                  className="min-w-0 flex-1 bg-transparent text-input text-fg outline-none placeholder:text-fg-muted"
                />
              </div>
            </div>
            <BaseCombobox.Empty className="item-padding text-xs text-fg-tertiary">
              No countries found
            </BaseCombobox.Empty>
            <BaseCombobox.List className="overflow-auto p-1">
              {(c: CountryEntry) => (
                <BaseCombobox.Item
                  key={c.code}
                  value={c}
                  className={optionItemClass}
                  data-testid={`${testid}-country-option-${c.code}`}
                >
                  <CountryFlag code={c.code} decorative size={18} className="shrink-0" />
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="text-fg-tertiary">+{c.callingCode}</span>
                  <BaseCombobox.ItemIndicator className="text-primary">
                    <Check className="size-icon" strokeWidth={3} />
                  </BaseCombobox.ItemIndicator>
                </BaseCombobox.Item>
              )}
            </BaseCombobox.List>
          </BaseCombobox.Popup>
        </BaseCombobox.Positioner>
      </BaseCombobox.Portal>
    </BaseCombobox.Root>
  )
}
