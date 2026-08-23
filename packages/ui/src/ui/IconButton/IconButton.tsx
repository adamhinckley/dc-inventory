'use client'

import { type ComponentPropsWithRef, type ReactNode } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Tooltip } from '#ds/ui/Tooltip'
import { cn } from '#cn'
import './IconButton.css'

// ---------------------------------------------------------------------------
// Variants
// ---------------------------------------------------------------------------

const iconButtonVariants = cva('interactable disableable inline-flex items-center justify-center', {
  variants: {
    variant: {
      // `.icon-btn` adds the glassmorphic gradient border — scoped to filled
      // so subtle and ghost render as clean transparent buttons.
      filled: 'icon-btn filled',
      subtle: 'subtle',
      ghost: 'ghost',
    },
    shape: {
      square: '',
      circle: 'circle',
    },
    size: {
      sm: 'size-7 [&>span]:size-icon-sm',
      md: 'size-8 [&>span]:size-icon',
      lg: 'size-10 [&>span]:size-icon-lg',
    },
  },
  defaultVariants: { variant: 'filled', shape: 'circle', size: 'md' },
})

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface IconButtonProps
  extends ComponentPropsWithRef<'button'>, VariantProps<typeof iconButtonVariants> {
  /** The icon element to display. SVGs scale to fill the icon wrapper. */
  icon: ReactNode
  /**
   * Renders present-but-unavailable with this text in a tooltip — the CORE-776
   * treatment for a CAPABILITY gate (missing permission verb) instead of hiding
   * the control or setting the native `disabled` attribute (which blocks
   * hover/focus, so the tooltip would be unreachable). State-based disabling
   * (form invalid, in flight) keeps using `disabled`.
   *
   * Mirrors `Button.disabledReason`; `aria-label` (already required for an
   * icon-only control) stays the control's accessible name.
   */
  disabledReason?: string
  /**
   * Required. Format: `{feature}-{view}-{element}`.
   * Example: `accounts-explorer-row-actions-trigger`.
   * See `.claude/rules/concepts/testid.md` for the full spec.
   */
  'data-testid'?: string
}

// ---------------------------------------------------------------------------
// IconButton
// ---------------------------------------------------------------------------

/**
 * Icon-only button. Centers an icon inside an interactable surface.
 *
 * @when Compact actions where the icon carries the meaning — kebab triggers,
 *   table-row actions, close/dismiss controls. Always pair with `aria-label`.
 * @avoid Action with text — use `Button` (which accepts a leading icon via
 *   `gap-icon`).
 * @variants variant (filled · subtle · ghost), shape (square · circle),
 *   size (sm · md · lg).
 */
export function IconButton({
  icon,
  className,
  variant,
  shape,
  size,
  disabledReason,
  ref,
  ...rest
}: IconButtonProps) {
  const glyph = (
    <span className="stacked flex items-center justify-center [&>svg]:size-full">{icon}</span>
  )

  if (disabledReason) {
    // Focusable non-interactive render, identical to `Button`'s: `aria-disabled`
    // + explicit tabIndex instead of the native `disabled` attribute, so hover
    // and keyboard focus still reach the Tooltip. onClick/disabled are dropped —
    // activation is suppressed. `{...inert}` spreads FIRST so the invariant
    // attributes win: a caller's `type="submit"` must not survive here (a native
    // submit button still implicitly submits on Enter with no onClick handler).
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { onClick: _onClick, disabled: _disabled, ...inert } = rest
    return (
      <Tooltip content={disabledReason}>
        <button
          ref={ref}
          className={cn(
            iconButtonVariants({ variant, shape, size }),
            'cursor-not-allowed opacity-40',
            className,
          )}
          {...inert}
          type="button"
          aria-disabled
          tabIndex={0}
        >
          {glyph}
        </button>
      </Tooltip>
    )
  }

  return (
    <button
      ref={ref}
      type="button"
      className={cn(iconButtonVariants({ variant, shape, size }), className)}
      {...rest}
    >
      {glyph}
    </button>
  )
}
