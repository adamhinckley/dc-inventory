'use client'

/**
 * Number range picker — two `NumberInput`s with shared bounds and
 * labeled Min / Max inputs. Value shape: `{ min?: number; max?: number }`.
 *
 * Note: the bound props (`min` / `max`) and the value keys
 * (`value.min` / `value.max`) share names but mean different things.
 * The bound props are absolute floor / ceiling on each input; the value
 * keys are the user's selected lower / upper. They're independent.
 *
 * @when Numeric range filters in the FilterBar (compact) and number
 *   range form fields (comfortable). Composite-primitive pattern with
 *   suffix-derived testids (`${testid}-min` / `${testid}-max`).
 * @avoid Single numbers — use `NumberInput`.
 * @variants density (comfortable | compact)
 */
export {
  NumberRangeInput,
  type NumberRangeInputProps,
  type NumberRangeValue,
} from './NumberRangeInput'
