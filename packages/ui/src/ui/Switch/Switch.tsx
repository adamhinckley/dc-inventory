import { type ComponentPropsWithRef } from 'react'
import { Switch as BaseSwitch } from '@base-ui-components/react/switch'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '#cn'

const switchVariants = cva(
  'interactable circle relative inline-flex shrink-0 items-center border border-border-field bg-transparent data-checked:border-primary data-checked:bg-primary ' +
    'aria-disabled:pointer-events-none aria-disabled:opacity-40 aria-disabled:cursor-default',
  {
    variants: {
      density: {
        comfortable: 'h-6 w-11',
        compact: 'h-5 w-9',
      },
    },
    defaultVariants: { density: 'comfortable' },
  },
)

const thumbVariants = cva(
  'pointer-events-none block rounded-full bg-fg-muted shadow-sm transition-transform data-checked:bg-primary-content',
  {
    variants: {
      density: {
        comfortable: 'h-4 w-4 data-checked:translate-x-6 data-unchecked:translate-x-0.5',
        compact: 'h-3.5 w-3.5 data-checked:translate-x-4.5 data-unchecked:translate-x-0.5',
      },
    },
    defaultVariants: { density: 'comfortable' },
  },
)

// Props extend `'button'` because Switch renders as an interactive button
// at runtime (Base UI's Switch.Root); ref is cast at the Base UI boundary
// because Base UI types its ref as `<span>`.
//
// `onChange` here is a value-change callback `(checked: boolean) => void`
// — NOT the native `<input>`'s `ChangeEvent` `onChange`. The design-system
// convention is that every primitive's value-change handler is named
// `onChange` and receives the new value directly.
export interface SwitchProps
  extends
    Omit<ComponentPropsWithRef<'button'>, 'type' | 'value' | 'onChange'>,
    VariantProps<typeof switchVariants> {
  checked?: boolean
  defaultChecked?: boolean
  onChange?: (checked: boolean) => void
  /**
   * Required. Format: `{feature}-{view}-{element}`.
   * Example: `accounts-detail-active-switch`.
   * See `.claude/rules/concepts/testid.md` for the full spec.
   */
  'data-testid'?: string
}

/**
 * Switch primitive backed by Base UI's Switch.Root + Switch.Thumb with a
 * density variant. Pure UI — no RHF coupling.
 *
 * @when Boolean values in forms (via `Form.Switch`'s RHF wrapper) or
 *   compact toggles in the FilterBar's BooleanEditor. Anywhere a binary
 *   on/off control needs to read like a switch rather than a checkbox —
 *   "enable feature," "send notifications," "auto-archive" patterns.
 *   For non-RHF use anywhere else, import this primitive directly.
 * @avoid Binary opt-ins inside cards or rows where a checkbox reads
 *   more naturally — use `Checkbox`. Inside a `Form.Field` — use
 *   `Form.Switch` so RHF wiring and `data-invalid` propagation come
 *   for free.
 */
export function Switch({
  ref,
  className,
  density,
  checked,
  defaultChecked,
  onChange,
  ...rest
}: SwitchProps) {
  return (
    <BaseSwitch.Root
      ref={ref as never}
      checked={checked}
      defaultChecked={defaultChecked}
      onCheckedChange={onChange}
      className={cn(switchVariants({ density }), className)}
      {...(rest as Record<string, unknown>)}
    >
      <BaseSwitch.Thumb className={thumbVariants({ density })} />
    </BaseSwitch.Root>
  )
}
