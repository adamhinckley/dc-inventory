'use client'

/**
 * Numeric input backed by Base UI's `NumberField`. Coerces keystrokes
 * to `number | null`; supports `min` / `max` / `step` bounds. No visible
 * stepper buttons by default — keyboard arrow keys still adjust value.
 *
 * @when Single-number form fields and FilterBar single-number editors.
 *   Anywhere a value should be a number rather than a string. Pass
 *   `stepper` for a visible − / + control (license quantity, per-tier counts).
 * @avoid Number ranges — use `NumberRangeInput`. Currency / unit-typed
 *   values where a unit needs to render alongside the number — those
 *   need their own primitive.
 * @variants density (comfortable | compact), stepper (boolean)
 */
export { NumberInput, type NumberInputProps } from './NumberInput'
