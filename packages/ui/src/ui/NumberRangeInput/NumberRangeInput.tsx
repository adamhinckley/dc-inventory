import { type ComponentPropsWithRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '#cn'
import { NumberInput } from '#ds/ui/NumberInput'

// Density-aware label class. `form-label` reads correctly in form
// fieldsets (comfortable); compact uses a smaller secondary treatment
// for the FilterBar popover context. Mirrors DateRangeInput.
const rangeLabelVariants = cva('', {
  variants: {
    density: {
      comfortable: 'form-label',
      compact: 'text-body-sm text-fg-tertiary',
    },
  },
  defaultVariants: { density: 'comfortable' },
})

export interface NumberRangeValue {
  /** User-selected lower side. Distinct from the `min` bound prop. */
  min?: number
  /** User-selected upper side. Distinct from the `max` bound prop. */
  max?: number
}

/**
 * Composite primitive — wrapper renders a `<div>`, so props extend
 * `ComponentPropsWithRef<'div'>`. `value`/`onChange` are owned by the
 * primitive (range shape, not native event); `onChange` is omitted from
 * the inherited div props.
 *
 * `data-testid` is accepted explicitly and derives `${testid}-min` /
 * `${testid}-max` for the two child NumberInputs. The wrapper itself
 * carries the root testid so tests can target the range as a whole.
 *
 * The bound props (`min` / `max`) and the value keys (`value.min` /
 * `value.max`) share names but mean different things. The bound props
 * are absolute floor / ceiling on each input; the value keys are the
 * user's selected lower / upper. They're independent.
 */
export interface NumberRangeInputProps
  extends
    Omit<ComponentPropsWithRef<'div'>, 'onChange' | 'min' | 'max'>,
    VariantProps<typeof rangeLabelVariants> {
  value: NumberRangeValue
  onChange: (next: NumberRangeValue) => void
  /** Absolute lower bound applied to both child inputs (input floor). */
  min?: number
  /** Absolute upper bound applied to both child inputs (input ceiling). */
  max?: number
  step?: number
  minLabel?: string
  maxLabel?: string
  minPlaceholder?: string
  maxPlaceholder?: string
  disabled?: boolean
  /** Standard `data-testid`. Lands on the wrapper div; child inputs
   *  derive `${testid}-min` / `${testid}-max`. */
  'data-testid'?: string
}

/**
 * Number range picker — two `NumberInput`s with shared bounds and
 * labeled Min / Max inputs. Value shape: `{ min?: number; max?: number }`
 * (matches the existing `FilterValue` number-range shape).
 *
 * @when Numeric range filters in the FilterBar (compact) and numeric
 *   range form fields (comfortable). Composite-primitive pattern with
 *   suffix-derived testids (`${testid}-min` / `${testid}-max`).
 * @avoid Single numbers — use `NumberInput`.
 */
export function NumberRangeInput({
  ref,
  className,
  density,
  value,
  onChange,
  min,
  max,
  step,
  minLabel = 'Min',
  maxLabel = 'Max',
  minPlaceholder,
  maxPlaceholder,
  disabled,
  'data-testid': testid,
  ...rest
}: NumberRangeInputProps) {
  return (
    <div
      ref={ref}
      className={cn('flex flex-row items-end gap-tight', className)}
      data-testid={testid}
      {...rest}
    >
      <div className="flex flex-1 flex-col gap-tight">
        {minLabel && <label className={rangeLabelVariants({ density })}>{minLabel}</label>}
        <NumberInput
          density={density ?? undefined}
          value={value.min ?? null}
          onChange={(next) => onChange({ ...value, min: next ?? undefined })}
          min={min}
          max={max}
          step={step}
          placeholder={minPlaceholder}
          disabled={disabled}
          data-testid={testid ? `${testid}-min` : undefined}
        />
      </div>
      <div className="flex flex-1 flex-col gap-tight">
        {maxLabel && <label className={rangeLabelVariants({ density })}>{maxLabel}</label>}
        <NumberInput
          density={density ?? undefined}
          value={value.max ?? null}
          onChange={(next) => onChange({ ...value, max: next ?? undefined })}
          min={min}
          max={max}
          step={step}
          placeholder={maxPlaceholder}
          disabled={disabled}
          data-testid={testid ? `${testid}-max` : undefined}
        />
      </div>
    </div>
  )
}
