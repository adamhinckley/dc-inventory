'use client'

import type { ComponentPropsWithRef } from 'react'
import { Menu as BaseMenu } from '@base-ui-components/react/menu'
import { cn } from '#cn'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type MenuSide = 'top' | 'bottom' | 'left' | 'right'
export type MenuAlign = 'start' | 'center' | 'end'

export interface MenuProps {
  children: React.ReactNode
  /** Controlled open state */
  open?: boolean
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void
}

export interface MenuTriggerProps extends ComponentPropsWithRef<'button'> {
  /** Open on hover. Default: false */
  openOnHover?: boolean
  /** Delay before opening on hover (ms). Default: 0 */
  delay?: number
  /** Delay before closing on hover (ms). Default: 300 */
  closeDelay?: number
  /**
   * Required. Format: `{feature}-{view}-{element}`.
   * Example: `accounts-explorer-row-actions-trigger`.
   * See `.claude/rules/concepts/testid.md` for the full spec.
   */
  'data-testid'?: string
}

export interface MenuContentProps extends ComponentPropsWithRef<'div'> {
  /** Which side of the trigger to position on. Default: 'bottom' */
  side?: MenuSide
  /** Alignment along the side. Default: 'start' */
  align?: MenuAlign
  /**
   * Required. Format: `{feature}-{view}-{element}`.
   * Example: `accounts-explorer-row-actions-popup`.
   * See `.claude/rules/concepts/testid.md` for the full spec.
   */
  'data-testid'?: string
}

export interface MenuItemProps {
  children: React.ReactNode
  className?: string
  /** Called when the item is selected */
  onClick?: () => void
  /** Disables selection and applies disabled styling. */
  disabled?: boolean
  /**
   * Whether selecting this item closes the menu. Default: true. Set false when
   * the item starts an in-flight action and the menu must stay open until the
   * parent dismisses it (e.g. a loading state on the same item).
   */
  closeOnClick?: boolean
  /**
   * Render the item as a different element (e.g. a Next.js `<Link>`). Base UI
   * merges its menu-item behavior onto the passed element, so there is one
   * focusable node — never wrap an interactive child like `<Link>` or `<a>`
   * inside `Menu.Item` directly; that creates two tab stops per row.
   */
  render?: React.ReactElement<Record<string, unknown>>
}

export interface MenuGroupLabelProps {
  children: React.ReactNode
  className?: string
}

export interface MenuSeparatorProps {
  className?: string
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

/**
 * Menu state root. Controls open/close.
 *
 * @when Wrap a `Menu.Trigger` and `Menu.Content`. Always the outermost piece.
 */
export function MenuRoot({ children, open, onOpenChange }: MenuProps) {
  return (
    <BaseMenu.Root open={open} onOpenChange={onOpenChange}>
      {children}
    </BaseMenu.Root>
  )
}

/**
 * Menu opener. Renders its own `<button>` via Base UI.
 *
 * @when Any element that opens the menu. Pass styling/ARIA directly — never
 *   nest a `<button>` inside (creates invalid `button > button` DOM).
 * @avoid Setting `openOnHover` on action menus that perform destructive
 *   actions — hover-open is for navigation menus, not commands.
 */
export function MenuTrigger({
  children,
  className,
  openOnHover = false,
  delay = 0,
  closeDelay = 300,
  ...rest
}: MenuTriggerProps) {
  return (
    <BaseMenu.Trigger
      className={cn('flex appearance-none border-0 bg-transparent p-0', className)}
      openOnHover={openOnHover}
      delay={delay}
      closeDelay={closeDelay}
      {...rest}
    >
      {children}
    </BaseMenu.Trigger>
  )
}

/**
 * Floating menu surface. Portals into the body, positioned by Base UI's
 * Positioner with the side/align supplied. The Positioner carries
 * `z-popover` so the menu paints above content.
 *
 * @when Wrap menu items. Always the only child of `<Menu>` after `Menu.Trigger`.
 * @avoid Putting non-menu content here (forms, rich layouts) — use `Popover`.
 * @tokens overlay (surface), z-popover (positioner z-index), rounded-section
 *   (corner radius)
 * @example
 * <Menu.Content side="bottom" align="end">
 *   <Menu.Item onClick={handleEdit}>Edit</Menu.Item>
 *   <Menu.Item onClick={handleDelete}>Delete</Menu.Item>
 * </Menu.Content>
 */
export function MenuContent({
  children,
  className,
  ref,
  side = 'bottom',
  align = 'start',
  ...rest
}: MenuContentProps) {
  return (
    <BaseMenu.Portal>
      <BaseMenu.Positioner side={side} align={align} sideOffset={4} className="z-popover">
        <BaseMenu.Popup
          ref={ref}
          className={cn(
            className,
            'z-popover overlay rounded-section p-item-y shadow-overlay',
          )}
          {...rest}
        >
          {children}
        </BaseMenu.Popup>
      </BaseMenu.Positioner>
    </BaseMenu.Portal>
  )
}

/**
 * Menu action. Selectable item — composes `interactable` + `item-padding` and
 * highlights via `data-highlighted:` for keyboard navigation.
 *
 * @when Any single action in the menu. Triggers `onClick` and dismisses.
 * @avoid Putting non-interactive content here — use `Menu.GroupLabel` for
 *   headings.
 */
export function MenuItem({
  children,
  className,
  onClick,
  disabled,
  closeOnClick,
  render,
}: MenuItemProps) {
  return (
    <BaseMenu.Item
      className={cn(
        'stacked interactable item-padding flex items-center gap-icon text-xs outline-hidden',
        'data-highlighted:bg-interactive-hover',
        'data-disabled:pointer-events-none data-disabled:opacity-40',
        className,
      )}
      onClick={onClick}
      disabled={disabled}
      closeOnClick={closeOnClick}
      render={render}
    >
      {children}
    </BaseMenu.Item>
  )
}

export interface MenuGroupProps {
  children: React.ReactNode
}

/**
 * ARIA group wrapper for related menu items.
 *
 * @when Wrapping a `Menu.GroupLabel` plus its items so screen readers
 *   announce them as a group.
 */
export function MenuGroup({ children }: MenuGroupProps) {
  return <BaseMenu.Group>{children}</BaseMenu.Group>
}

/**
 * Section heading inside a `Menu.Group`. Renders the `overlay-group-label`
 * text role.
 *
 * @when The first child of a `Menu.Group`, identifying the group's purpose.
 */
export function MenuGroupLabel({ children, className }: MenuGroupLabelProps) {
  return (
    <BaseMenu.GroupLabel className={cn('stacked item-padding overlay-group-label', className)}>
      {children}
    </BaseMenu.GroupLabel>
  )
}

/**
 * Thin horizontal rule between menu sections. Bleeds to the popup edges by
 * cancelling the popup's `p-item-y` padding so the rule spans full width.
 *
 * @when Marking a boundary between distinct sections — an identity header and
 *   a settings group, a settings group and a sign-out action.
 * @avoid As the first or last child, or between every row — it marks section
 *   boundaries, not item gaps. For semantically grouped items use `Menu.Group`.
 * @tokens border-border (rule color), padding-item-y (edge-bleed offset)
 */
export function MenuSeparator({ className }: MenuSeparatorProps) {
  return (
    <BaseMenu.Separator className={cn('-mx-(--padding-item-y) my-1 h-px bg-border', className)} />
  )
}
