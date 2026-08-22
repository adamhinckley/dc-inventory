import type { ComponentPropsWithRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Tooltip } from '#ds/ui/Tooltip'
import { cn } from '#cn'

// ---------------------------------------------------------------------------
// Variants
// ---------------------------------------------------------------------------

export const buttonVariants = cva(
  'interactable disableable inline-flex items-center justify-center gap-icon text-button font-medium',
  {
    variants: {
      variant: {
        default:
          'bg-interactive text-fg-secondary border border-border hover:bg-interactive-hover hover:text-fg hover:border-border-field-hover',
        primary: 'bg-primary-strong text-primary-content hover:bg-primary-strong/90',
        secondary: 'bg-secondary text-secondary-content hover:bg-secondary/90',
        ghost: 'ghost',
        destructive: 'bg-error text-error-content hover:bg-error/90',
      },
      size: {
        xs: 'h-6 px-2 text-xs',
        sm: 'h-7 px-2.5 text-button',
        md: 'h-8 px-button-x py-button-y',
        lg: 'h-10 px-5 text-body',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  },
)

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ButtonProps
  extends ComponentPropsWithRef<'button'>, VariantProps<typeof buttonVariants> {
  /**
   * Present-but-unavailable mode (FE-4/FE-5, CORE-776): when set, the button
   * renders dimmed and non-interactive (`aria-disabled`, click ignored) but
   * stays in the tab order, wrapped in a `Tooltip` carrying this reason —
   * typically `permissionDisabledReason(...)`. Use for capability gating
   * (missing permission verb) instead of hiding the control or the native
   * `disabled` attribute (which blocks hover/focus, so the tooltip would be
   * unreachable). State-based disabling (form invalid, in flight) keeps
   * using `disabled`.
   */
  disabledReason?: string
  /**
   * Required. Format: `{feature}-{view}-{element}`.
   * Example: `accounts-explorer-create-button`.
   * See `.claude/rules/concepts/testid.md` for the full spec.
   */
  'data-testid'?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Standard button. Five visual variants and three sizes.
 *
 * @when Any clickable action — primary CTAs, cancel buttons, toolbar
 *   actions, submit/cancel pairs in dialogs.
 * @avoid Async operations (form submits, save buttons, mutations) — use
 *   `LoadingButton`, which auto-disables, sets `aria-busy`, and shows a
 *   spinner while in flight. Icon-only triggers (kebab menus, close
 *   buttons) — use `IconButton`. Wrapping a Base UI Trigger (Dialog/Menu/
 *   Popover) — those render their own `<button>`; pass styling directly to
 *   the Trigger instead of nesting a Button.
 * @variants variant (`default`/`primary`/`secondary`/`ghost`/`destructive`),
 *   size (`sm`/`md`/`lg`)
 */
export function Button({ ref, className, variant, size, disabledReason, ...rest }: ButtonProps) {
  if (disabledReason) {
    // Focusable non-interactive render (the RouterTabs.Trigger disabled
    // pattern): `aria-disabled` + explicit tabIndex instead of the native
    // `disabled` attribute, so hover and keyboard focus still reach the
    // Tooltip. onClick/disabled are dropped — activation is suppressed.
    // `{...inert}` spreads FIRST so the invariant attributes win: a caller's
    // `type="submit"` must not survive here — a native submit button still
    // implicitly submits on Enter even with no onClick handler.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { onClick: _onClick, disabled: _disabled, ...inert } = rest
    return (
      <Tooltip content={disabledReason}>
        <button
          ref={ref}
          className={cn(
            buttonVariants({ variant, size }),
            'cursor-not-allowed opacity-40',
            className,
          )}
          {...inert}
          type="button"
          aria-disabled
          tabIndex={0}
        />
      </Tooltip>
    )
  }
  return (
    <button
      ref={ref}
      type="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...rest}
    />
  )
}
