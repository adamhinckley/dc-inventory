import type { ComponentPropsWithRef } from 'react'
import { Popover as BasePopover } from '@base-ui-components/react/popover'
import { cn } from '#cn'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type PopoverSide = 'top' | 'bottom' | 'left' | 'right'
export type PopoverAlign = 'start' | 'center' | 'end'

/** Base UI's close-event details. `details.reason` is `'outside-press'`,
 *  `'escape-key'`, `'trigger-press'`, etc.; `details.cancel()` stops Base UI
 *  from acting on the close so the popover stays open. */
export type PopoverChangeEventDetails = BasePopover.Root.ChangeEventDetails

export interface PopoverProps {
  children: React.ReactNode
  /** Controlled open state */
  open?: boolean
  /** Callback when open state changes. The second arg carries Base UI's
   *  reason + cancel() — inspect it to selectively block outside-press
   *  or escape-key closes. */
  onOpenChange?: (open: boolean, details: PopoverChangeEventDetails) => void
}

export interface PopoverTriggerProps extends ComponentPropsWithRef<'button'> {
  /**
   * Required. Format: `{feature}-{view}-{element}`.
   * Example: `topbar-user-menu-trigger`.
   * See `.claude/rules/concepts/testid.md` for the full spec.
   */
  'data-testid'?: string
}

export interface PopoverContentProps extends ComponentPropsWithRef<'div'> {
  /** Which side of the trigger to position on. Default: 'bottom' */
  side?: PopoverSide
  /** Alignment along the side. Default: 'center' */
  align?: PopoverAlign
  /**
   * Required. Format: `{feature}-{view}-{element}`.
   * Example: `topbar-user-menu-popup`.
   * See `.claude/rules/concepts/testid.md` for the full spec.
   */
  'data-testid'?: string
  /** Override the positioning anchor. Defaults to `Popover.Trigger`. Use this
   *  when the trigger element shouldn't be the visual anchor (e.g., a
   *  composite primitive with multiple trigger buttons sharing one popup —
   *  pass a ref to the wrapper element). */
  anchor?: React.RefObject<Element | null> | Element | null
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

/**
 * Popover state root. Controls open/close.
 *
 * @when Wrap a `Popover.Trigger` and `Popover.Content`. Always the outermost piece.
 */
export function PopoverRoot({ children, open, onOpenChange }: PopoverProps) {
  return (
    <BasePopover.Root open={open} onOpenChange={onOpenChange}>
      {children}
    </BasePopover.Root>
  )
}

/**
 * Popover opener. Renders its own `<button>` via Base UI.
 *
 * @when Any element that opens the popover. Pass styling/ARIA directly —
 *   never nest a `<button>` inside (creates invalid `button > button` DOM).
 */
export function PopoverTrigger({ children, className, ...rest }: PopoverTriggerProps) {
  return (
    <BasePopover.Trigger className={cn('inline-flex', className)} {...rest}>
      {children}
    </BasePopover.Trigger>
  )
}

/**
 * Floating popover surface. Portals into the body, positioned by Base UI's
 * Positioner. The Positioner carries `z-popover` so the panel paints above
 * content.
 *
 * @when Wrap arbitrary popover content. Always the only child of `<Popover>`
 *   after `Popover.Trigger`.
 * @tokens overlay (surface), z-popover (positioner z-index), rounded-section
 *   (corner radius)
 */
export function PopoverContent({
  children,
  className,
  ref,
  side = 'bottom',
  align = 'center',
  anchor,
  ...rest
}: PopoverContentProps) {
  return (
    <BasePopover.Portal>
      <BasePopover.Positioner
        side={side}
        align={align}
        sideOffset={4}
        anchor={anchor}
        className="z-popover"
      >
        <BasePopover.Popup
          ref={ref}
          className={cn(
            className,
            'z-popover overlay rounded-section p-2 shadow-overlay',
          )}
          {...rest}
        >
          {children}
        </BasePopover.Popup>
      </BasePopover.Positioner>
    </BasePopover.Portal>
  )
}
