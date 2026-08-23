import { type ComponentPropsWithRef } from 'react'
import { Checkbox as BaseCheckbox } from '@base-ui-components/react/checkbox'
import { Check, Minus } from 'lucide-react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '#cn'

// Fill color is driven by a CSS variable on the root so border, bg, and
// the indicator's text color all flip together. Default = primary;
// data-invalid flips to the error pair so checked invalid checkboxes
// paint border + bg in the same red as the unchecked invalid border.
// data-disabled flips to fg-muted for both fill and content so checked
// disabled checkboxes paint border + bg in the same grey as the unchecked
// disabled border. data-disabled wins over data-invalid (a disabled
// control is non-interactive — invalid state is moot).
const checkboxVariants = cva(
  '[--checkbox-fill:var(--color-primary)] [--checkbox-fill-content:var(--color-primary-content)] ' +
    'data-invalid:[--checkbox-fill:var(--color-error)] data-invalid:[--checkbox-fill-content:var(--color-error-content)] ' +
    'data-disabled:[--checkbox-fill:var(--color-fg-muted)] data-disabled:[--checkbox-fill-content:var(--color-fg)] ' +
    'inline-flex items-center justify-center rounded-sm border border-border-field bg-transparent ' +
    'data-checked:border-(--checkbox-fill) data-checked:bg-(--checkbox-fill) ' +
    'data-indeterminate:border-(--checkbox-fill) data-indeterminate:bg-(--checkbox-fill) ' +
    'data-invalid:border-error ' +
    'data-disabled:border-fg-muted data-disabled:cursor-not-allowed',
  {
    variants: {
      density: {
        comfortable: 'h-4 w-4',
        compact: 'h-3.5 w-3.5',
      },
    },
    defaultVariants: { density: 'comfortable' },
  },
)

// Indicator icon size per density. Single source of truth for "what icon
// size goes with what density." Adding a third density requires extending
// both this map and the `checkboxVariants` CVA — TypeScript will catch
// the mismatch since `keyof typeof INDICATOR_ICON_SIZE` is referenced in
// the lookup below.
const INDICATOR_ICON_SIZE = {
  comfortable: 12,
  compact: 10,
} as const

// Props extend `'button'` because Checkbox renders as an interactive
// button at runtime (Base UI's Checkbox.Root); ref is cast at the Base UI
// boundary because Base UI types its ref as `<span>`.
//
// `onChange` here is a value-change callback `(checked: boolean) => void`
// — NOT the native `<input>`'s `ChangeEvent` `onChange`. We diverge from
// native input semantics to match the headless-primitive convention used
// across the rest of our design system (Switch, Combobox, Autocomplete).
export interface CheckboxProps
  extends
    Omit<ComponentPropsWithRef<'button'>, 'type' | 'value' | 'onChange'>,
    VariantProps<typeof checkboxVariants> {
  checked?: boolean
  defaultChecked?: boolean
  indeterminate?: boolean
  onChange?: (checked: boolean) => void
  /**
   * Required. Format: `{feature}-{view}-{element}`.
   * Example: `accounts-create-form-active-checkbox`.
   * See `.claude/rules/concepts/testid.md` for the full spec.
   */
  'data-testid'?: string
}

/**
 * Checkbox primitive backed by Base UI's Checkbox.Root + Checkbox.Indicator
 * with a density variant. Pure UI — no RHF coupling.
 *
 * @when Multi-select option lists in the FilterBar (compact density),
 *   binary opt-ins inside row-style content, list-pickers where each item
 *   is a checkbox. Inside a `<Form>`, prefer `Form.Checkbox` (RHF wrapper
 *   that auto-wires `data-invalid` from the field context). For non-RHF
 *   use anywhere else, import this primitive directly.
 * @avoid On/off toggles where the visual should read as a switch — use
 *   `Switch`. Single-select option lists — use `Combobox` (Phase 4).
 *   Inside a `Form.Field` — use `Form.Checkbox` so RHF wiring and
 *   `data-invalid` propagation come for free.
 */
export function Checkbox({
  ref,
  className,
  density,
  checked,
  defaultChecked,
  indeterminate,
  onChange,
  ...rest
}: CheckboxProps) {
  const resolvedDensity = density ?? 'comfortable'
  const iconSize = INDICATOR_ICON_SIZE[resolvedDensity]
  return (
    <BaseCheckbox.Root
      ref={ref as never}
      checked={checked}
      defaultChecked={defaultChecked}
      indeterminate={indeterminate}
      onCheckedChange={onChange}
      className={cn(checkboxVariants({ density: resolvedDensity }), className)}
      {...(rest as Record<string, unknown>)}
    >
      <BaseCheckbox.Indicator className="text-(--checkbox-fill-content)">
        {indeterminate ? (
          <Minus size={iconSize} strokeWidth={3} />
        ) : (
          <Check size={iconSize} strokeWidth={3} />
        )}
      </BaseCheckbox.Indicator>
    </BaseCheckbox.Root>
  )
}
