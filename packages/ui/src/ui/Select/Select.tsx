'use client'

import { useEffect, useState, type ComponentPropsWithRef } from 'react'
import { Select as BaseSelect } from '@base-ui-components/react/select'
import { Check, ChevronDown } from 'lucide-react'
import { cva, type VariantProps } from 'class-variance-authority'
import { PII_MASK_CLASS } from '#shared/constants/pii-mask'
import { cn } from '#cn'
import type { Option } from '#shared/resource/types'

// Chrome (border, padding, focus ring, typography) on the trigger button.
// Base UI Select's trigger is a `<button>` — no internal `<input>` — so
// the typography sits on the trigger itself, not a separate element.
const triggerVariants = cva(
  'flex w-full items-center justify-between gap-tight bg-surface-card text-left transition-[border-color] ' +
    'disabled:cursor-not-allowed disabled:opacity-60 ' +
    'focus:border-primary focus:outline-none',
  {
    variants: {
      density: {
        comfortable:
          'min-h-(--space-input-height) rounded-interactable border border-border-field px-input-x py-input-y text-input text-fg ' +
          'hover:border-border-field-hover ' +
          'data-invalid:border-error',
        compact:
          'rounded-interactable border border-border-field hover:border-border-field-hover px-input-x-compact py-input-y-compact text-body-sm text-fg ' +
          'data-invalid:border-error',
      },
    },
    defaultVariants: { density: 'comfortable' },
  },
)

// Async resolver — mirrors `Combobox`'s `useResolvedOptions` so callers
// can use the same `options: Option<T>[] | (() => Promise<Option<T>[]>)` shape
// across the two primitives. Static arrays pass through unchanged.
function useResolvedOptions<T extends string | number | boolean>(
  source: Option<T>[] | (() => Promise<Option<T>[]>),
): {
  resolved: Option<T>[]
  internalLoading: boolean
} {
  const isStatic = Array.isArray(source)
  const [resolved, setResolved] = useState<Option<T>[]>(isStatic ? source : [])
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

// Props extend `'button'` because the rendered trigger is a `<button>`.
// `ref` and caller-supplied ARIA / `id` / `name` flow to the trigger.
// `className` lands on the trigger so caller styling can adjust chrome.
//
// The `T` generic flows through `options`, `value`, and `onChange` so the
// primitive accepts any primitive value type — strings (cube-backed
// dimensions), booleans (status toggles), or numbers. The default `string`
// keeps every existing call site type-correct without modification.
export interface SelectProps<T extends string | number | boolean = string>
  extends
    Omit<ComponentPropsWithRef<'button'>, 'value' | 'onChange' | 'name' | 'type'>,
    VariantProps<typeof triggerVariants> {
  /**
   * Static options array OR an async loader run once on mount. Cube-backed
   * options resolve in the resource-system dispatchers via
   * `useFilterOptions`; this primitive doesn't know about `OptionsSource`.
   */
  options: Option<T>[] | (() => Promise<Option<T>[]>)
  /**
   * External loading state. OR'd with the primitive's internal loading
   * state when `options` is an async function.
   */
  loading?: boolean
  multiple?: boolean
  value: T | null
  onChange: (next: T | null) => void

  /** Optional override of the auto-derived form/filter name. */
  name?: string
  /** Placeholder text shown when no value is selected. */
  placeholder?: string
  /**
   * Whether the trigger shows the selected option's `label` (default) or
   * its raw `value` string. Mirrors Base UI's two-modes-of-`Select.Value`:
   * passing `items` to `Select.Root` renders the matching label;
   * omitting items renders the raw value.
   */
  display?: 'label' | 'value'
  /** Standard `data-testid`. Lands on the trigger; items derive `${testid}-option-${value}`. */
  'data-testid'?: string
  /** Marks the trigger as invalid; fires the `data-invalid:border-error` CVA variant. */
  'data-invalid'?: boolean
  /**
   * When true, marks the trigger and popup for marker.io PII masking — apply
   * when option labels are user data (account names, person names, emails).
   */
  pii?: boolean
}

/**
 * Constrained option picker backed by Base UI's Select. Trigger button
 * shows the selected option (label or value), opens a popup list. No
 * typeahead filtering — for free-form filtering use `Combobox`. Density
 * variant for form vs filter chrome.
 *
 * @when Picking from a short, known list where the user doesn't need to
 *   type to filter (status, role, account type, sort order). Inside a
 *   `<Form>`, prefer `Form.Select` (RHF wrapper that auto-wires
 *   `data-invalid`).
 * @avoid Long option lists where typeahead filtering matters — use
 *   `Combobox`. Free-form text with optional suggestions — use
 *   `Autocomplete`. On/off binary values — use `Switch` / `Checkbox`.
 */
export function Select<T extends string | number | boolean = string>({
  options,
  loading: externalLoading,
  value,
  onChange,
  placeholder,
  density,
  disabled,
  className,
  ref,
  name,
  display = 'label',
  pii,
  'data-testid': testid,
  'data-invalid': dataInvalid,
  ...rest
}: SelectProps<T>) {
  const { resolved, internalLoading } = useResolvedOptions<T>(options)
  const loading = Boolean(externalLoading) || internalLoading

  // `items` controls how `Select.Value` formats the selected value: when
  // present, Base UI auto-renders the matching `label`; when absent, it
  // renders the raw value (coerced to a string). We pass items only in
  // `display="label"` mode so the same primitive handles both UX modes
  // without forking.
  return (
    <BaseSelect.Root<T>
      items={display === 'label' ? resolved : undefined}
      value={value ?? undefined}
      onValueChange={(next) => onChange(next as T | null)}
      disabled={disabled}
      name={name}
    >
      <BaseSelect.Trigger
        ref={ref}
        className={cn(triggerVariants({ density }), pii && PII_MASK_CLASS, className)}
        data-invalid={dataInvalid}
        data-testid={testid}
        {...rest}
      >
        {/*
          When `items` is provided, omitting `children` lets Base UI auto-resolve
          the label from the matching item. A render-prop child would receive
          the raw value instead — fatal for booleans, since `<span>{false}</span>`
          renders nothing. The `data-placeholder:` variant styles the empty state.
        */}
        <BaseSelect.Value className="truncate data-placeholder:text-fg-tertiary">
          {value == null ? placeholder : undefined}
        </BaseSelect.Value>
        <BaseSelect.Icon className="text-fg-tertiary">
          <ChevronDown className="size-icon" />
        </BaseSelect.Icon>
      </BaseSelect.Trigger>
      <BaseSelect.Portal>
        <BaseSelect.Positioner
          className="z-popover"
          alignItemWithTrigger={false}
          side="bottom"
          align="start"
          sideOffset={4}
        >
          <BaseSelect.Popup
            className={cn(
              'overlay rounded-interactable shadow-overlay min-w-(--anchor-width) max-h-72 overflow-auto',
              pii && PII_MASK_CLASS,
            )}
          >
            {loading ? (
              <div className="item-padding text-xs text-fg-tertiary">Loading...</div>
            ) : resolved.length === 0 ? (
              <div className="item-padding text-xs text-fg-tertiary">No options</div>
            ) : (
              <BaseSelect.List>
                {resolved.map((item) => (
                  <BaseSelect.Item
                    key={String(item.value)}
                    value={item.value}
                    className="stacked interactable ghost item-padding flex items-center justify-between gap-icon text-xs data-highlighted:bg-interactive-strong data-selected:font-medium"
                    data-testid={testid ? `${testid}-option-${String(item.value)}` : undefined}
                  >
                    <BaseSelect.ItemText>{item.label}</BaseSelect.ItemText>
                    <BaseSelect.ItemIndicator className="text-primary">
                      <Check className="size-icon" strokeWidth={3} />
                    </BaseSelect.ItemIndicator>
                  </BaseSelect.Item>
                ))}
              </BaseSelect.List>
            )}
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  )
}
