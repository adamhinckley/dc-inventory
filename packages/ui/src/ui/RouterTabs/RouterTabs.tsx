'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Children, type ComponentPropsWithRef } from 'react'
import { Tooltip } from '#ds/ui/Tooltip'
import { cn } from '#cn'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface RouterTabsRootProps extends ComponentPropsWithRef<'div'> {
  /**
   * Required. Format: `{feature}-{view}-{element}`.
   * Example: `accounts-detail-router-tabs`.
   * See `.claude/rules/concepts/testid.md` for the full spec.
   */
  'data-testid'?: string
}

export interface RouterTabsListProps extends ComponentPropsWithRef<'nav'> {}

export interface RouterTabsTriggerProps extends Omit<ComponentPropsWithRef<'a'>, 'href'> {
  /**
   * Route to navigate to. The trigger is "active" when `usePathname()`
   * equals the path portion of this — a query string (e.g. a carried
   * `?org=` scope param) navigates but is ignored for matching.
   */
  href: string
  /**
   * When true, the trigger is also active for any sub-route under `href`.
   * Use for the default tab (route base) so it stays active on its own
   * default content.
   */
  exact?: boolean
  /**
   * Render the tab present-but-unavailable: dimmed, never active, and
   * non-navigating (no `<Link>`, so clicking / Enter does nothing). The
   * element stays focusable (`tabIndex={0}`, `aria-disabled`) so the `tooltip`
   * remains reachable by keyboard and touch. Use when the destination exists
   * for this user's cohort but is gated by a per-resource precondition (e.g. an
   * org without credential monitoring) — pair with `tooltip` to say why. For a
   * tab the user's cohort shouldn't see at all, omit the trigger entirely
   * instead of disabling it.
   */
  disabled?: boolean
  /**
   * Hover/focus hint, typically the reason the tab is `disabled`. Falsy renders
   * the trigger without a tooltip wrapper.
   */
  tooltip?: string
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

/**
 * RouterTabs container. Just structural — no controlled state because the
 * URL is the source of truth (each trigger is a `<Link>`).
 *
 * @when Wrap a `RouterTabs.List` and an optional `RouterTabs.Panel`.
 * @example
 * <RouterTabs>
 *   <RouterTabs.List>
 *     <RouterTabs.Trigger href={`/accounts/${id}`} exact>Organizations</RouterTabs.Trigger>
 *     <RouterTabs.Trigger href={`/accounts/${id}/users`}>Users</RouterTabs.Trigger>
 *   </RouterTabs.List>
 * </RouterTabs>
 */
export function RouterTabsRoot({ ref, className, children, ...rest }: RouterTabsRootProps) {
  return (
    <div
      ref={ref}
      className={cn(
        'section-flat rounded-section flex flex-col',
        // When a descendant tab holds a sticky table, become a definite-height
        // flex column so the card can bind its height (CORE-1009). Inert
        // otherwise.
        'has-data-sticky-table:min-h-0 has-data-sticky-table:flex-1',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
}

/**
 * Tab strip. `role="tablist"` row of `RouterTabs.Trigger` children with a
 * bottom border. Renders nothing when every trigger is conditioned away
 * (`{show && <Trigger>}` all false) — an empty tablist is just a stray
 * border and a lie to assistive tech (FE-3 / CORE-602 zero-tab degradation).
 *
 * @when Direct child of `<RouterTabs>`. One per RouterTabs instance.
 * @avoid Relying on this to hide the whole detail chrome — the consumer's
 *   content/children still render; route-level fallbacks (e.g. the org
 *   index redirect placeholder) own the "no tabs at all" experience.
 */
export function RouterTabsList({ ref, className, children, ...rest }: RouterTabsListProps) {
  // Children.toArray drops the `false`/`null` left by conditional triggers,
  // so this counts renderable children only. Triggers are composed in the
  // same client component as the List (never across an RSC boundary), so
  // counting here is safe.
  if (Children.toArray(children).length === 0) {
    return null
  }
  return (
    <nav
      ref={ref}
      role="tablist"
      // `shrink-0` (plain, not a `:has` variant): the List is a sibling of the
      // Panel and contains no table, so it can't react to `:has([data-sticky-
      // table])` — but the tab strip is natural height in every mode, so
      // keeping it from shrinking under the flex-1 sibling is always safe.
      className={cn('relative flex shrink-0 border-b border-border', className)}
      {...rest}
    >
      {children}
    </nav>
  )
}

/**
 * Single tab. Renders a Next.js `<Link>` to `href`. Active when the current
 * pathname matches `href` — by prefix by default, exactly when `exact` is set.
 *
 * @when Inside `RouterTabs.List`. Mark the default tab (route base) with
 *   `exact` so it stays active on its own content but not on sibling routes.
 *   Set `disabled` (+ `tooltip`) to show the tab present-but-unavailable.
 * @avoid Pointing two triggers at the same `href` — only one will ever be
 *   active. Disabling a tab the user's cohort shouldn't see — omit it instead.
 */
export function RouterTabsTrigger({
  ref,
  href,
  exact,
  disabled,
  tooltip,
  className,
  children,
  ...rest
}: RouterTabsTriggerProps) {
  const pathname = usePathname() ?? ''

  if (disabled) {
    // Present-but-unavailable: a non-navigating `<a>` (no `href`, so no click /
    // Enter activation) that stays in the tab order so the tooltip is reachable
    // by keyboard and touch. Replicates the trigger geometry directly rather
    // than via `tab-trigger` — that utility carries `cursor-pointer` and
    // `hover:text-primary`, which would fight the dimmed, non-interactive look.
    return (
      <Tooltip content={tooltip}>
        <a
          ref={ref}
          role="tab"
          aria-selected={false}
          aria-disabled
          tabIndex={0}
          className={cn(
            'border-b-2 border-transparent px-card py-section-content-y',
            'section-tab cursor-default opacity-40',
            className,
          )}
          {...rest}
        >
          {children}
        </a>
      </Tooltip>
    )
  }

  // Default-tab route is the base path; non-defaults use prefix-match so
  // nested routes keep the correct trigger active. Mark default tabs with
  // `exact` so they don't stay active for sibling tabs. `usePathname()`
  // carries no query string, so matching uses the href's path portion only.
  const hrefPath = href.split(/[?#]/)[0] ?? href
  const isActive = exact
    ? pathname === hrefPath
    : pathname === hrefPath || pathname.startsWith(hrefPath + '/')

  return (
    <Link
      ref={ref}
      href={href}
      role="tab"
      aria-selected={isActive}
      // Safari skips anchors in sequential tab navigation by default
      // (only form controls are tabbable unless the user enables "Press Tab
      // to highlight each item on a webpage"). Explicit tabIndex={0} forces
      // Safari to include router tabs in the tab order to match Chrome/Firefox.
      tabIndex={0}
      className={cn(
        'tab-trigger section-tab',
        'aria-selected:section-tab-active aria-selected:border-accent-indicator',
        className,
      )}
      {...rest}
    >
      {children}
    </Link>
  )
}

/**
 * Panel wrapper. Optional — usually the route's child layout fills the panel
 * area directly. Provides `p-card` padding when a wrapper is needed.
 *
 * @when Wrapping page content under `RouterTabs.List` for consistent padding
 *   without nesting another section.
 */
export function RouterTabsPanel({
  ref,
  className,
  children,
  ...rest
}: ComponentPropsWithRef<'div'>) {
  return (
    <div
      ref={ref}
      className={cn(
        'p-card',
        // Sticky-table tab: the card owns the scroll, so the panel is a
        // definite-height flex frame that never scrolls (CORE-1009). Normal
        // tabs keep the block-flow `p-card` behaviour and scroll via the body.
        'has-data-sticky-table:flex has-data-sticky-table:min-h-0 has-data-sticky-table:flex-1 has-data-sticky-table:flex-col has-data-sticky-table:overflow-hidden',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
}
