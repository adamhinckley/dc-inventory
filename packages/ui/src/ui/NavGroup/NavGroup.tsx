'use client'

import type { ComponentPropsWithRef } from 'react'
import { NavigationMenu } from '@base-ui-components/react/navigation-menu'
import { Collapsible } from '@base-ui-components/react/collapsible'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Tooltip } from '#ds/ui/Tooltip'
import { cn } from '#cn'

// ---------------------------------------------------------------------------
// Variants
// ---------------------------------------------------------------------------

const navItemVariants = cva(
  'relative interactable ghost flex items-center pl-(--space-left-padding-navItem) pr-input-x py-item-y text-body focus-visible:-outline-offset-2',
  {
    variants: {
      active: {
        true: 'text-fg',
        false: '',
      },
    },
    defaultVariants: { active: false },
  },
)

// ---------------------------------------------------------------------------
// NavGroup.Item
// ---------------------------------------------------------------------------

export interface NavGroupItemProps
  extends ComponentPropsWithRef<'a'>, VariantProps<typeof navItemVariants> {
  /** Destination href passed to Next.js Link. */
  href: string
  /**
   * Optional numeric badge rendered to the right of the item label (e.g., an
   * unread count). When omitted no badge is shown.
   */
  badge?: number
  /**
   * Render the item present-but-unavailable: dimmed, never active, and
   * non-navigating (no `<Link>`, so clicking / Enter does nothing). The element
   * stays focusable (`tabIndex={0}`, `aria-disabled`) so a reason tooltip stays
   * reachable by keyboard and touch. Use when the destination exists for this
   * user's cohort but a permission is missing (FE-4 / CORE-603) — for an item
   * the cohort shouldn't see at all, omit it entirely instead of disabling it.
   */
  disabled?: boolean
  /**
   * Hover/focus hint, typically the reason the item is `disabled` (FE-5 /
   * CORE-606). Only rendered on the disabled branch; falsy renders no tooltip.
   */
  tooltip?: string
}

/**
 * A single navigation link within a NavGroup section.
 *
 * @when Use for every nav link inside a NavGroup. Renders as an accessible
 *   anchor with keyboard navigation and aria-current="page" when active.
 * @avoid Using outside a NavGroup — it requires the NavigationMenu root
 *   context provided by NavGroup.
 * @tokens text-body (link text), fg-secondary/fg (inactive/active color),
 *   interactive-hover (hover bg), accent-indicator (active indicator stripe),
 *   text-badge (badge count text)
 */
export function NavGroupItem({
  href,
  active = false,
  badge,
  disabled,
  tooltip,
  className,
  children,
  ref,
  ...rest
}: NavGroupItemProps) {
  if (disabled) {
    // Present-but-unavailable: a non-navigating `<a>` (no `href`, so no click /
    // Enter activation) that stays in the tab order so the `tooltip` reason is
    // reachable by keyboard and touch. Replicates the item geometry directly
    // rather than via `navItemVariants` — the `interactable ghost` archetype
    // carries hover styles that would fight the dimmed, non-interactive look.
    return (
      <NavigationMenu.Item>
        <Tooltip content={tooltip}>
          <a
            ref={ref}
            role="link"
            aria-disabled
            tabIndex={0}
            style={{ '--space-left-padding-navItem': '28px' } as React.CSSProperties}
            className={cn(
              'relative flex items-center pl-(--space-left-padding-navItem) pr-input-x py-item-y',
              'text-body text-fg-secondary cursor-default opacity-40',
              'focus-visible:-outline-offset-2',
              className,
            )}
            {...rest}
          >
            <span className="flex-1 truncate">{children}</span>
            {badge !== undefined && <span className="text-badge text-fg-secondary">{badge}</span>}
          </a>
        </Tooltip>
      </NavigationMenu.Item>
    )
  }

  return (
    <NavigationMenu.Item>
      <NavigationMenu.Link
        ref={ref}
        render={<Link href={href} />}
        active={active ?? false}
        // Safari skips anchors in sequential tab navigation by default
        // (only form controls are tabbable unless the user enables "Press Tab
        // to highlight each item on a webpage"). Explicit tabIndex={0} forces
        // Safari to include nav links in the tab order to match Chrome/Firefox.
        tabIndex={0}
        style={{ '--space-left-padding-navItem': '28px' } as React.CSSProperties}
        className={cn(navItemVariants({ active }), className)}
        {...rest}
      >
        {active && (
          <span
            className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-accent-indicator"
            aria-hidden="true"
          />
        )}
        <span className="flex-1 truncate">{children}</span>
        {badge !== undefined && <span className="text-badge text-fg-secondary">{badge}</span>}
      </NavigationMenu.Link>
    </NavigationMenu.Item>
  )
}

// ---------------------------------------------------------------------------
// NavGroup
// ---------------------------------------------------------------------------

export interface NavGroupProps extends ComponentPropsWithRef<'nav'> {
  /**
   * Section heading displayed above the nav items. Also used as the
   * accessible name for the nav landmark (aria-label).
   */
  label: string
  /**
   * Icon rendered in the trigger button before the label. Required so the
   * group remains identifiable when collapsed to icon-only mode.
   */
  icon: React.ReactNode
  /** Whether the group starts expanded. Defaults to true. Ignored when `open` is provided. */
  defaultOpen?: boolean
  /**
   * Controlled open state. When provided, `defaultOpen` is ignored and the
   * caller manages expand/collapse via `onOpenChange`.
   */
  open?: boolean
  /** Called when the open state changes (controlled mode). */
  onOpenChange?: (open: boolean) => void
  /**
   * When true, renders an icon-only collapsed view — no label, no chevron,
   * no items list. Clicking the icon calls `onExpand`. Defaults to false.
   */
  collapsed?: boolean
  /** Called when the icon button is clicked while `collapsed` is true. */
  onExpand?: () => void
  /**
   * Required. Format: `{feature}-{view}-{element}`.
   * Example: `sidebar-exposure-nav-group`.
   * See `.claude/rules/concepts/testid.md` for the full spec.
   */
  'data-testid'?: string
}

/**
 * A labeled, collapsible section of navigation items for use in sidebar
 * navigation. Renders a <nav> landmark with a trigger button (icon + section
 * label + chevron) that toggles the list open and closed. Active items display
 * a primary-colored indicator stripe and aria-current="page".
 *
 * Supports controlled open state via `open`/`onOpenChange`, and a collapsed
 * icon-only mode via `collapsed`/`onExpand` for narrow sidebar layouts.
 *
 * @when Organizing sidebar nav links into named, collapsible sections
 *   (e.g., "EXPOSURE", "SOC", "ADMIN"). Use one NavGroup per section.
 * @avoid Using for horizontal navigation, dropdown menus, or any grouped list
 *   that isn't navigation.
 * @tokens text-body (trigger label + item text), fg-muted
 *   (label color), fg-secondary/fg (item inactive/active color),
 *   interactive-hover (item hover bg), accent-indicator (active indicator stripe)
 * @example
 * <NavGroup label="Exposure" icon={<ShieldIcon />}>
 *   <NavGroup.Item href="/overview">Overview</NavGroup.Item>
 *   <NavGroup.Item href="/incidents" active>Incident Explorer</NavGroup.Item>
 * </NavGroup>
 *
 * @example Controlled
 * <NavGroup
 *   label="Exposure"
 *   icon={<ShieldIcon />}
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 * >
 *   <NavGroup.Item href="/overview">Overview</NavGroup.Item>
 * </NavGroup>
 *
 * @example Collapsed (icon-only)
 * <NavGroup
 *   label="Exposure"
 *   icon={<ShieldIcon />}
 *   collapsed
 *   onExpand={() => setSidebarExpanded(true)}
 * >
 *   <NavGroup.Item href="/overview">Overview</NavGroup.Item>
 * </NavGroup>
 */
export function NavGroupRoot({
  label,
  icon,
  defaultOpen = true,
  open,
  onOpenChange,
  collapsed = false,
  onExpand,
  className,
  children,
  ref,
  ...rest
}: NavGroupProps) {
  if (collapsed) {
    return (
      <nav aria-label={label} className={cn('flex flex-col', className)} ref={ref} {...rest}>
        <button
          type="button"
          onClick={onExpand}
          aria-label={label}
          className="interactable subtle flex items-center justify-center px-input-x py-item-y focus-visible:-outline-offset-2"
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center [&>svg]:size-full">
            {icon}
          </span>
        </button>
      </nav>
    )
  }

  const collapsibleProps = open !== undefined ? { open, onOpenChange } : { defaultOpen }

  return (
    <Collapsible.Root {...collapsibleProps} className={cn('flex flex-col text-body', className)}>
      <NavigationMenu.Root ref={ref} orientation="vertical" aria-label={label} {...rest}>
        <Collapsible.Trigger className="group interactable subtle flex w-full items-center gap-icon px-input-x py-item-y focus-visible:-outline-offset-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center [&>svg]:size-full">
            {icon}
          </span>
          <span className="flex-1 truncate text-left">{label}</span>
          <ChevronDown
            className="size-icon-sm transition-transform duration-200 group-data-panel-open:rotate-180"
            aria-hidden="true"
          />
        </Collapsible.Trigger>
        {/* keepMounted so collapsed items remain in the DOM for crawlability and focus restoration */}
        <Collapsible.Panel
          keepMounted
          className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out"
        >
          <NavigationMenu.List className="flex flex-col pb-1">{children}</NavigationMenu.List>
        </Collapsible.Panel>
      </NavigationMenu.Root>
    </Collapsible.Root>
  )
}
