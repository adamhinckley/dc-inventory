'use client'

import type { ComponentPropsWithRef } from 'react'
import { Dialog as BaseDialog } from '@base-ui-components/react/dialog'
import { cva, type VariantProps } from 'class-variance-authority'
import { X } from 'lucide-react'
import { cn } from '#cn'

// ---------------------------------------------------------------------------
// Variants
// ---------------------------------------------------------------------------

const drawerContentVariants = cva(
  'fixed top-0 z-drawer flex h-full flex-col overlay px-region-x py-region-y shadow-modal outline-hidden transition-transform duration-200 ease-out data-starting-style:duration-0',
  {
    variants: {
      side: {
        left: 'left-0 data-ending-style:-translate-x-full data-starting-style:-translate-x-full',
        right: 'right-0 data-ending-style:translate-x-full data-starting-style:translate-x-full',
      },
      size: {
        sm: 'w-72',
        md: 'w-96',
        lg: 'w-lg',
      },
    },
    defaultVariants: { side: 'right', size: 'md' },
  },
)

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DrawerRootProps {
  children: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export interface DrawerTriggerProps {
  children: React.ReactNode
  className?: string
  /**
   * Required. Format: `{feature}-{view}-{element}`.
   * Example: `incidents-explorer-filters-drawer-trigger`.
   * See `.claude/rules/concepts/testid.md` for the full spec.
   */
  'data-testid'?: string
}

export interface DrawerContentProps
  extends ComponentPropsWithRef<'div'>, VariantProps<typeof drawerContentVariants> {
  /**
   * Required. Format: `{feature}-{view}-{element}`.
   * Example: `incidents-explorer-filters-drawer`.
   * See `.claude/rules/concepts/testid.md` for the full spec.
   */
  'data-testid'?: string
}

export type DrawerHeaderProps = ComponentPropsWithRef<'div'>

export type DrawerBodyProps = ComponentPropsWithRef<'div'>

export type DrawerFooterProps = ComponentPropsWithRef<'div'>

export type DrawerTitleProps = ComponentPropsWithRef<'h2'>

export type DrawerDescriptionProps = ComponentPropsWithRef<'p'>

export type DrawerCloseProps = ComponentPropsWithRef<'button'>

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

/**
 * Drawer state root. Controls open/close.
 *
 * @when Wrap a `Drawer.Trigger` and `Drawer.Content`. Always the outermost piece.
 */
export function DrawerRoot({ children, open, onOpenChange }: DrawerRootProps) {
  return (
    <BaseDialog.Root open={open} onOpenChange={onOpenChange}>
      {children}
    </BaseDialog.Root>
  )
}

/**
 * Drawer opener. Renders its own `<button>` via Base UI.
 *
 * @when Any element that opens the drawer. Pass styling/ARIA directly —
 *   never nest a `<button>` inside (creates invalid `button > button` DOM).
 */
export function DrawerTrigger({ children, className, 'data-testid': testid }: DrawerTriggerProps) {
  return (
    <BaseDialog.Trigger className={cn('inline-flex', className)} data-testid={testid}>
      {children}
    </BaseDialog.Trigger>
  )
}

/**
 * Drawer container. Anchors to the left or right edge, full viewport height.
 * Owns all outer padding — sub-components have no horizontal padding and no
 * top/bottom edge padding. Mirrors `Dialog.Content`'s padding contract.
 *
 * @when Wrap all drawer content. Always the only child of `<Drawer>` after `Drawer.Trigger`.
 * @avoid Adding horizontal padding to header/body/footer — they inherit it
 *   from here. Mixing direct children with sub-components without honoring
 *   this contract will produce inconsistent padding.
 * @tokens overlay (container surface), z-drawer (z-index), backdrop (scrim color),
 *   px-region-x/py-region-y (outer padding)
 * @example
 * <Drawer.Content side="right" size="md">
 *   <Drawer.Header>
 *     <Drawer.Title>Filter results</Drawer.Title>
 *     <Drawer.Close />
 *   </Drawer.Header>
 *   <Drawer.Body>...</Drawer.Body>
 *   <Drawer.Footer>
 *     <Button variant="ghost">Reset</Button>
 *     <Button>Apply</Button>
 *   </Drawer.Footer>
 * </Drawer.Content>
 */
export function DrawerContent({
  children,
  ref,
  className,
  side,
  size,
  ...rest
}: DrawerContentProps) {
  return (
    <BaseDialog.Portal>
      <BaseDialog.Backdrop className="fixed inset-0 z-drawer bg-backdrop transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0" />
      <BaseDialog.Popup
        ref={ref}
        className={cn(drawerContentVariants({ side, size }), className)}
        {...rest}
      >
        {children}
      </BaseDialog.Popup>
    </BaseDialog.Portal>
  )
}

/**
 * Drawer header. Layout only — no horizontal padding (DrawerContent owns it).
 * Bottom border acts as a separator from the body.
 *
 * @when Title row at the top of the drawer. Pair with `Drawer.Title` and
 *   optionally `Drawer.Close`.
 * @avoid Adding horizontal padding here — the container owns it.
 */
export function DrawerHeader({ ref, className, children, ...rest }: DrawerHeaderProps) {
  return (
    <div
      ref={ref}
      className={cn(
        'stacked flex shrink-0 items-center justify-between gap-region border-b border-border pb-region-y',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
}

/**
 * Drawer body. Scrollable middle slot with its own region padding.
 *
 * @when Primary content of the drawer (forms, lists, detail panes).
 * @avoid Setting typography on this container — text styling belongs on
 *   content elements via text roles.
 */
export function DrawerBody({ ref, className, children, ...rest }: DrawerBodyProps) {
  return (
    <div
      ref={ref}
      className={cn('stacked flex-1 overflow-y-auto py-section-content-y', className)}
      {...rest}
    >
      {children}
    </div>
  )
}

/**
 * Drawer footer. Layout only — no horizontal padding (DrawerContent owns it).
 * Top border acts as a separator; actions right-aligned.
 *
 * @when Action buttons (Cancel, Apply, Submit). Bottom slot of the drawer.
 * @avoid Adding horizontal padding here — the container owns it.
 */
export function DrawerFooter({ ref, className, children, ...rest }: DrawerFooterProps) {
  return (
    <div
      ref={ref}
      className={cn(
        'stacked flex shrink-0 items-center justify-end gap-action border-t border-border pt-region-y',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
}

/**
 * Drawer title heading. Renders the `overlay-title` text role.
 *
 * @when The first child of `Drawer.Header`.
 */
export function DrawerTitle({ ref, className, children, ...rest }: DrawerTitleProps) {
  return (
    <BaseDialog.Title ref={ref} className={cn('stacked overlay-title', className)} {...rest}>
      {children}
    </BaseDialog.Title>
  )
}

/**
 * Drawer description. Renders the `overlay-description` text role.
 *
 * @when Optional secondary text directly under `Drawer.Title`.
 */
export function DrawerDescription({ ref, className, children, ...rest }: DrawerDescriptionProps) {
  return (
    <BaseDialog.Description
      ref={ref}
      className={cn('stacked overlay-description', className)}
      {...rest}
    >
      {children}
    </BaseDialog.Description>
  )
}

/**
 * Drawer close button. Renders an X icon by default; pass `children` to
 * override.
 *
 * @when The trailing item of `Drawer.Header`. Calls `onOpenChange(false)`.
 */
export function DrawerClose({ ref, className, children, ...rest }: DrawerCloseProps) {
  return (
    <BaseDialog.Close
      ref={ref}
      className={cn(
        'stacked interactable subtle inline-flex h-8 w-8 items-center justify-center',
        className,
      )}
      aria-label="Close"
      {...rest}
    >
      {children ?? <X size={18} />}
    </BaseDialog.Close>
  )
}
