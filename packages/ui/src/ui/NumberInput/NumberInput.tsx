import { type ComponentPropsWithRef } from 'react'
import { NumberField as BaseNumberField } from '@base-ui-components/react/number-field'
import { cva, type VariantProps } from 'class-variance-authority'
import { Minus, Plus } from 'lucide-react'
import { PII_MASK_CLASS } from '#shared/constants/pii-mask'
import { cn } from '#cn'

// Mirrors TextInput's density CVA so single-number form fields and
// FilterBar number editors share the same chrome. After Phase 7 the
// duplicated `inputVariants` shape across TextInput / NumberInput is a
// /consolidate candidate.
const inputVariants = cva(
  'w-full bg-surface-card text-fg placeholder:text-fg-muted transition-[border-color] disabled:cursor-not-allowed disabled:opacity-60 ' +
    'focus:border-primary focus:outline-none',
  {
    variants: {
      density: {
        comfortable:
          'min-h-(--space-input-height) rounded-interactable border border-border-field px-input-x py-input-y text-input ' +
          'hover:border-border-field-hover ' +
          'data-invalid:border-error',
        compact:
          'rounded-interactable border border-border-field hover:border-border-field-hover px-input-x-compact py-input-y-compact text-body-sm ' +
          'data-invalid:border-error',
      },
    },
    defaultVariants: { density: 'comfortable' },
  },
)

// Stepper path: the chrome (border, height, focus/hover/invalid state) moves
// from the bare input onto the NumberField.Group wrapper. The Group is not the
// focus target — the descendant input is — so the focus indicator is
// `focus-within:border-primary` (design-tokens.md wrapper rule) rather than
// the bare-input path's `focus:border-primary`. `data-disabled` is propagated
// onto the Group by Base UI from Root's `disabled`. `overflow-hidden` clips the
// button hover fills to the rounded corners. The disabled *dim* lives on each
// child (input + buttons) via their own `disabled` attribute, NOT here — an
// opacity on the Group would multiply with the children's own disabled opacity
// and render the buttons darker than the input.
const groupVariants = cva(
  'flex w-full items-center overflow-hidden bg-surface-card text-fg rounded-interactable border transition-[border-color] ' +
    'focus-within:border-primary data-disabled:cursor-not-allowed',
  {
    variants: {
      density: {
        comfortable:
          'min-h-(--space-input-height) border-border-field hover:border-border-field-hover data-invalid:border-error',
        compact: 'border-border-field hover:border-border-field-hover data-invalid:border-error',
      },
    },
    defaultVariants: { density: 'comfortable' },
  },
)

// The center input in the stepper path is borderless and transparent — the
// Group owns the surface and border. Text centers over `tabular-nums` so the
// digits don't shift width as the value changes.
const stepperInputVariants = cva(
  'min-w-0 flex-1 bg-transparent text-center tabular-nums text-fg placeholder:text-fg-muted ' +
    'outline-none disabled:cursor-not-allowed disabled:opacity-60',
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

// The − / + buttons style the Base UI `.Decrement` / `.Increment` elements
// directly (each renders its own `<button>`). Padding sets the control height
// and touch target per density — never a fixed `h-*`. `.ghost` is the default
// emphasis (transparent, matches surrounding chrome). Base UI sets the button's
// `disabled` attribute both at its bound (min/max) and when the whole control is
// disabled; the `disabled:` utilities dim to 60% to match the input rather than
// `.disableable`'s 40% — a lone difference so the button and input read the same
// when the Group is disabled.
const stepperButtonVariants = cva(
  'interactable ghost flex shrink-0 items-center justify-center disabled:pointer-events-none disabled:opacity-60',
  {
    variants: {
      density: {
        comfortable: 'px-input-x py-input-y',
        compact: 'px-input-x-compact py-input-y-compact',
      },
    },
    defaultVariants: { density: 'comfortable' },
  },
)

/**
 * Props extend `ComponentPropsWithRef<'input'>` per `ui.md` (the rendered
 * element is an `<input>`). Native props the primitive owns are `Omit`-ed:
 * `value` becomes `number | null`, `onChange` fires with `number | null`,
 * and `min`/`max`/`step`/`name`/`type` are forwarded to Base UI's NumberField
 * Root rather than the underlying input attributes directly.
 */
export interface NumberInputProps
  extends
    Omit<
      ComponentPropsWithRef<'input'>,
      'value' | 'onChange' | 'name' | 'type' | 'min' | 'max' | 'step' | 'defaultValue'
    >,
    VariantProps<typeof inputVariants> {
  /** Extra classes. Inherited from `ComponentPropsWithRef<'input'>`, so the
   *  type implies the `<input>`; it lands there in the bare path, but in
   *  `stepper` mode it retargets to the `NumberField.Group` wrapper (which owns
   *  the border/height/layout chrome there), not the inner `<input>`. Pass
   *  width/layout classes expecting the outer chrome. */
  className?: string
  /** Current value, or `null` when the input is empty. */
  value?: number | null
  /** Called with the parsed number, or `null` when the input is cleared. */
  onChange?: (value: number | null) => void
  /** Absolute lower bound (input floor). */
  min?: number
  /** Absolute upper bound (input ceiling). */
  max?: number
  /** Increment / decrement step (also used by keyboard arrows). */
  step?: number
  /** Optional override of the form/filter name on the underlying input. */
  name?: string
  /** Standard `data-testid`. Lands on the underlying `<input>`. */
  'data-testid'?: string
  /** Marks the control as invalid so the `data-invalid:border-error` CVA
   *  variant fires. Lands on the bare `<input>` by default; in `stepper`
   *  mode it lands on the `NumberField.Group` wrapper instead (the Group
   *  owns the border there), not the inner `<input>`. */
  'data-invalid'?: boolean
  /**
   * When true, marks the input element for marker.io PII masking. Most
   * numeric fields are not PII — apply only where the number itself
   * identifies a person (e.g. national ID, SSN-style fields).
   */
  pii?: boolean
  /**
   * Render − / + buttons flanking the input (Base UI `NumberField.Group`).
   * The buttons step by `step` and auto-disable at `min` / `max`. Default
   * false — existing form and FilterBar consumers keep the bare input.
   */
  stepper?: boolean
}

/**
 * Numeric input wrapping Base UI's `NumberField`. Coerces keystrokes to
 * `number | null`; supports `min` / `max` / `step` bounds. No visible
 * stepper buttons by default — keyboard arrow keys still adjust value.
 *
 * @when Single-number form fields (`Form.NumberInput`) and FilterBar
 *   single-number editors. Anywhere a value should be a number rather
 *   than a string. Pass `stepper` for a visible − / + control (license
 *   quantity, per-tier counts).
 * @avoid Number ranges — use `NumberRangeInput`. Currency / unit-typed
 *   values where a unit needs to render alongside the number — those
 *   need their own primitive.
 */
export function NumberInput({
  ref,
  className,
  density,
  value,
  onChange,
  min,
  max,
  step,
  name,
  placeholder,
  disabled,
  onBlur,
  pii,
  stepper,
  'data-testid': testid,
  'data-invalid': dataInvalid,
  ...rest
}: NumberInputProps) {
  return (
    <BaseNumberField.Root
      value={value ?? null}
      onValueChange={(next) => onChange?.(next)}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      name={name}
    >
      {stepper ? (
        <BaseNumberField.Group
          className={cn(groupVariants({ density }), className)}
          data-invalid={dataInvalid}
        >
          {/* tabIndex={-1} + aria-hidden: the buttons are a pointer-only
              convenience, fully redundant with typing into the labeled input
              (Base UI gives it aria-roledescription="Number field", not
              spinbutton semantics — so the ± affordance carries no unique
              a11y meaning). We keep them out of both the tab order and the
              accessibility tree rather than labeling a duplicate control
              (accessibility.md § when to make something tabbable, step 2). */}
          <BaseNumberField.Decrement
            tabIndex={-1}
            aria-hidden
            className={stepperButtonVariants({ density })}
            data-testid={testid ? `${testid}-decrement` : undefined}
          >
            <Minus className="size-icon" />
          </BaseNumberField.Decrement>
          <BaseNumberField.Input
            ref={ref}
            placeholder={placeholder}
            onBlur={onBlur}
            className={cn(stepperInputVariants({ density }), pii && PII_MASK_CLASS)}
            data-testid={testid}
            {...rest}
          />
          <BaseNumberField.Increment
            tabIndex={-1}
            aria-hidden
            className={stepperButtonVariants({ density })}
            data-testid={testid ? `${testid}-increment` : undefined}
          >
            <Plus className="size-icon" />
          </BaseNumberField.Increment>
        </BaseNumberField.Group>
      ) : (
        <BaseNumberField.Input
          ref={ref}
          placeholder={placeholder}
          onBlur={onBlur}
          className={cn(inputVariants({ density }), pii && PII_MASK_CLASS, className)}
          data-testid={testid}
          data-invalid={dataInvalid}
          {...rest}
        />
      )}
    </BaseNumberField.Root>
  )
}
