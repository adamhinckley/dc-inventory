import { useEffect, useRef, useState, type ComponentPropsWithRef } from 'react'
import { Autocomplete as BaseAutocomplete } from '@base-ui-components/react/autocomplete'
import { ChevronDown, X } from 'lucide-react'
import { cva, type VariantProps } from 'class-variance-authority'
import { PII_MASK_CLASS } from '#shared/constants/pii-mask'
import { cn } from '#cn'
import type { Option } from '#shared/resource/types'

// Chrome lives on the wrapper. Typography goes on the Autocomplete.Input
// element below — content-typography-on-content per the design-tokens rule.
const inputGroupVariants = cva(
  'flex w-full items-center gap-tight bg-surface-card transition-[border-color] disabled:cursor-not-allowed disabled:opacity-60 ' +
    'focus-within:border-primary',
  {
    variants: {
      density: {
        comfortable:
          'rounded-interactable border border-border-field px-input-x py-input-y ' +
          'hover:border-border-field-hover ' +
          'data-invalid:border-error',
        compact:
          'rounded-interactable border border-border-field hover:border-border-field-hover px-input-x-compact py-input-y-compact ' +
          'data-invalid:border-error',
      },
    },
    defaultVariants: { density: 'comfortable' },
  },
)

const inputVariants = cva(
  'flex-1 bg-transparent outline-none text-fg placeholder:text-fg-muted disabled:cursor-not-allowed',
  {
    variants: {
      density: {
        comfortable: 'text-input',
        compact: 'text-body-sm',
      },
    },
    defaultVariants: { density: 'comfortable' },
  },
)

// Async resolver — runs the async loader on mount, tracks internal loading
// state, surfaces resolved options. Same shape as Combobox's
// useResolvedOptions; kept inline here per rule-of-three (only two
// consumers; not yet worth extracting).
function useResolvedOptions(source: Option[] | (() => Promise<Option[]>)): {
  resolved: Option[]
  internalLoading: boolean
} {
  const isStatic = Array.isArray(source)
  const [resolved, setResolved] = useState<Option[]>(isStatic ? source : [])
  const [internalLoading, setInternalLoading] = useState(false)

  useEffect(() => {
    if (isStatic) return
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInternalLoading(true)
    source()
      .then((result) => {
        if (!cancelled) setResolved(result)
      })
      .catch(() => {
        if (!cancelled) setResolved([])
      })
      .finally(() => {
        if (!cancelled) setInternalLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [source, isStatic])

  return { resolved: isStatic ? source : resolved, internalLoading }
}

// Props extend `'input'` because the primary interactable in the rendered
// DOM is the typing `<input>` (Base UI's `Autocomplete.Input`). `ref` and
// caller-supplied `aria-*` / `id` / `autoComplete` flow to that input.
// `className` lands on the outer InputGroup wrapper for chrome customization.
//
// `onChange` is a value-change callback per the design-system convention.
// Free-form input: `(value: string) => void`. The user's typed text is
// preserved on blur even if it doesn't match a suggestion. When the user
// picks a suggestion, `onChange` fires with the option's display label.
export interface AutocompleteProps
  extends
    Omit<ComponentPropsWithRef<'input'>, 'value' | 'onChange' | 'name' | 'type' | 'list'>,
    VariantProps<typeof inputGroupVariants> {
  /**
   * Suggestion options. Static array OR an async loader run on mount.
   * Empty list = no suggestions; the input still works as a free-form
   * text field (use `<TextInput>` instead if you never want suggestions).
   *
   * Cube-backed options resolve in the resource-system dispatchers via
   * `useFilterOptions`; this primitive doesn't know about `OptionsSource`.
   */
  options: Option[] | (() => Promise<Option[]>)
  /** External loading state. OR'd with internal loading when async. */
  loading?: boolean

  /** The current input value. Free-form text or a selected option's label. */
  value: string
  /** Called with the typed string or a selected option's display label. */
  onChange: (next: string) => void

  /** Optional override of the auto-derived form/filter name. */
  name?: string
  /** Show a clear button when the input has a value. */
  clearable?: boolean
  /** Placeholder for the input. */
  placeholder?: string
  /** Standard `data-testid`. Lands on the input; options derive `${testid}-option-${value}`. */
  'data-testid'?: string
  /** Marks the input group as invalid; lands on the wrapper div so the
   *  `data-invalid:border-error` CVA variant fires. Form.Autocomplete
   *  forwards this from RHF's field error state automatically. */
  'data-invalid'?: boolean
  /**
   * When true, marks the input chrome and suggestion popup for marker.io
   * PII masking — apply when the input value or option labels are user
   * data (emails, names, addresses).
   */
  pii?: boolean
}

/**
 * Autocomplete primitive backed by Base UI's Autocomplete. Free-form text
 * input with optional suggestions; single-value only. Density variant
 * for form vs filter chrome.
 *
 * @when Tag-style inputs, address autocompletion with custom values,
 *   search-with-suggestions, any field where the user might type
 *   something not in the suggestion list. Inside a `<Form>`, prefer
 *   `Form.Autocomplete` (RHF wrapper that auto-wires `data-invalid`).
 * @avoid Constrained option lists where the user must pick one of the
 *   provided options — use `Combobox`. Pure free-form text with no
 *   suggestions ever — use `TextInput`. On/off binary values — use
 *   `Switch` / `Checkbox`. Server-driven typeahead (each keystroke fires
 *   a query) — not yet supported; surface as a follow-up.
 */
export function Autocomplete({
  options,
  loading: externalLoading,
  value,
  onChange,
  placeholder,
  density,
  clearable = false,
  disabled,
  className,
  ref,
  name,
  onBlur,
  pii,
  'data-testid': testid,
  'data-invalid': dataInvalid,
  ...rest
}: AutocompleteProps) {
  const { resolved, internalLoading } = useResolvedOptions(options)
  const loading = Boolean(externalLoading) || internalLoading
  const showPopup = loading || resolved.length > 0
  // Anchor the popup to the wrapping InputGroup div (not the inner
  // <input>) so the popup aligns with the chrome edges and
  // `--anchor-width` matches the InputGroup's full width.
  const groupRef = useRef<HTMLDivElement>(null)

  return (
    <BaseAutocomplete.Root
      items={resolved}
      value={value}
      onValueChange={(next) => onChange(next)}
      disabled={disabled}
    >
      <div
        ref={groupRef}
        className={cn(inputGroupVariants({ density }), pii && PII_MASK_CLASS, className)}
        data-invalid={dataInvalid}
      >
        <BaseAutocomplete.Input
          ref={ref as never}
          name={name}
          placeholder={placeholder}
          onBlur={onBlur}
          className={inputVariants({ density })}
          data-testid={testid}
          {...(rest as Record<string, unknown>)}
        />
        {clearable && value && (
          <BaseAutocomplete.Clear className="text-fg-tertiary hover:text-fg transition-colors">
            <X className="size-icon" />
          </BaseAutocomplete.Clear>
        )}
        <BaseAutocomplete.Trigger className="text-fg-tertiary hover:text-fg transition-colors">
          <BaseAutocomplete.Icon>
            <ChevronDown className="size-icon" />
          </BaseAutocomplete.Icon>
        </BaseAutocomplete.Trigger>
      </div>
      {showPopup && (
        <BaseAutocomplete.Portal>
          <BaseAutocomplete.Positioner
            anchor={groupRef}
            className="z-popover"
            side="bottom"
            align="start"
            sideOffset={4}
          >
            <BaseAutocomplete.Popup
              className={cn(
                'overlay rounded-interactable shadow-overlay min-w-(--anchor-width) max-h-72 overflow-auto',
                pii && PII_MASK_CLASS,
              )}
            >
              {loading ? (
                <div className="item-padding text-xs text-fg-tertiary">Loading...</div>
              ) : (
                <BaseAutocomplete.List>
                  {(item: Option) => (
                    <BaseAutocomplete.Item
                      key={item.value}
                      value={item.label}
                      className="stacked interactable ghost item-padding flex items-center text-xs data-highlighted:bg-interactive-strong data-selected:font-medium"
                      data-testid={testid ? `${testid}-option-${item.value}` : undefined}
                    >
                      {item.label}
                    </BaseAutocomplete.Item>
                  )}
                </BaseAutocomplete.List>
              )}
            </BaseAutocomplete.Popup>
          </BaseAutocomplete.Positioner>
        </BaseAutocomplete.Portal>
      )}
    </BaseAutocomplete.Root>
  )
}
