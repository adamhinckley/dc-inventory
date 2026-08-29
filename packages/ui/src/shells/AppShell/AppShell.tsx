'use client'

import {
  Children,
  isValidElement,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { GripVertical, Menu as MenuIcon, X } from 'lucide-react'
import { Drawer } from '#ds/ui/Drawer'
import { IconButton } from '#ds/ui/IconButton'
import { LogoAnimated } from '#ds/ui/Logo'
import { Menu } from '#ds/ui/Menu'
import { NavGroup as UINavGroup } from '#ds/ui/NavGroup'
import { Toast } from '#ds/ui/Toast'
import { usePreference } from '#shared/hooks/use-preference'
import { cn } from '#cn'
import { useAppShell } from './AppShell.hook'
import { AppShellContext, useAppShellContext } from './AppShell.context'

// ---------------------------------------------------------------------------
// Shared nav styles — single source of truth for text + icon sizing
// ---------------------------------------------------------------------------

/** Items + actions: standard nav text */
export const itemLabel = 'text-xs'
/** Badges: small counts */
const badgeLabel = 'text-2xs font-medium'
/** Icon wrapper: consistent size, SVGs scale to fill */
export const iconBox = 'flex h-5 w-5 flex-shrink-0 items-center justify-center [&>svg]:size-full'
/** Interactive row: shared padding + radius + hover for all clickable nav elements */
export const navRow = 'interactable subtle flex w-full items-center px-tight py-item-y'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AppShellProps {
  /** Sidebar navigation */
  nav?: ReactNode
  /** Top bar — renders inside the elevated page panel */
  topbar?: ReactNode
  /**
   * Persistent full-bleed bar pinned to the very top of the frame, spanning
   * the full viewport width above BOTH the sidebar and the page panel (e.g. an
   * impersonation or alpha-preview notice). Omit for the normal frame.
   */
  banner?: ReactNode
  /**
   * Render ONLY the main content — no sidebar, topbar, or banner — at natural
   * height/width. For the headless PDF export deployment (`isExportMode()`): the
   * captured page is just the content, and because the on-screen layout already
   * matches the printed one (no chrome to reflow away), charts size correctly.
   */
  exportMode?: boolean
  /** Page content */
  children: ReactNode
}

export interface BrandingLogo {
  light?: string | null
  dark?: string | null
}

export interface NavRootProps {
  children: ReactNode
  /** White-label partner logo URLs. Omit for the default animated 360Privacy logo. */
  brandingLogo?: BrandingLogo | null
  /** Custom header element replacing the default logo header. */
  header?: ReactNode
  /** Where clicking the logo navigates. Default: "/" */
  href?: string
}

export interface NavGroupProps {
  /** Unique ID, used for preference persistence key */
  id: string
  /** Section header text */
  label: string
  /** Icon shown in header and in collapsed (icon-only) state */
  icon: ReactNode
  /** NavItem children */
  children: ReactNode
}

export interface NavItemProps {
  /** Route path */
  href: string
  /** Display text */
  label: string
  /** Optional icon beside the label */
  icon?: ReactNode
  /** Optional count badge */
  badge?: number
  /**
   * Search params carried over from the current URL onto this item's link
   * (e.g. `['org']` keeps a page-local org scope across sibling routes).
   * Active-state matching always uses the bare `href` — params only affect
   * the rendered link target.
   */
  preserveParams?: string[]
  /**
   * Fixed query string (`key=value&…`) appended to this item's link — a default landing
   * state the item should always navigate to (e.g. the dashboard's default date filter, so
   * clicking the item lands on it rather than an empty/cleared view). Unlike `preserveParams`
   * (copied from the current URL), these are constant; a current-URL `preserveParams` value
   * overrides a same-named default. Active-state matching still uses the bare `href`.
   */
  defaultParams?: string
  /**
   * Render the item present-but-unavailable — dimmed, `aria-disabled`,
   * non-navigating (FE-4 / CORE-603: the user's type may see the surface but
   * a route permission is missing). Applies in both the expanded list and the
   * collapsed rail's hover menu.
   */
  disabled?: boolean
  /**
   * Why the item is `disabled` (FE-5 / CORE-606). Expanded list: rendered as
   * a hover/focus tooltip on the dimmed item. Collapsed rail's hover menu:
   * rendered as an inline muted line under the label instead — the disabled
   * `Menu.Item` is `pointer-events-none`, so a tooltip could never fire there.
   */
  disabledReason?: string
  /**
   * Explicit active override. When set, wins over the internal `pathname`
   * prefix match — the consumer has computed active-state across the full nav
   * set (longest-match-wins), which a per-item prefix check can't do when one
   * nav href is a prefix of another (e.g. `/incidents` vs `/incidents/heatmap`,
   * where both would otherwise light up on the deeper route). Omit to keep the
   * standalone prefix behavior.
   */
  active?: boolean
}

export interface NavActionProps {
  /** Icon element */
  icon: ReactNode
  /** Label text — visible when expanded, used as aria-label when collapsed */
  label: string
  /** Click handler */
  onClick?: () => void
}

export interface NavTenantItemProps {
  /** Route the tenant overview links to (the user's account or single-org page) */
  href: string
  /** Account / organization display name — visible expanded, used as aria-label collapsed */
  label: string
  /** Glyph shown when no logo is available, and in the collapsed icon rail */
  icon: ReactNode
  /** Optional white-label logo; falls back to `icon` on absence or load error */
  logo?: BrandingLogo | null
  /** Explicit active override (longest-match, computed across the full nav set). See `NavItemProps.active`. */
  active?: boolean
}

export interface NavFooterProps {
  children: ReactNode
}

export interface NavToolbarProps {
  children: ReactNode
}

export interface TopbarRootProps {
  children: ReactNode
}

export interface TopbarActionsProps {
  children: ReactNode
}

// ---------------------------------------------------------------------------
// AppShellRoot
// ---------------------------------------------------------------------------

/**
 * AppShell container. Renders the dashboard frame (sidebar + elevated page
 * panel + topbar + main content) and provides the AppShell context plus the
 * Toast provider/viewport.
 *
 * @when Wrap dashboard route content in a layout. Pass `nav` and `topbar`
 *   slots; route content goes in `children`.
 * @avoid Adding business state here — feature contexts belong inside route
 *   layouts. Server-side auth should live in `app/` route layouts; the shell
 *   is purely chrome.
 */
export function AppShellRoot({ nav, topbar, banner, children, exportMode }: AppShellProps) {
  const appShell = useAppShell()
  // Default `isExpanded` to the desktop sidebar's state. The mobile drawer
  // re-provides this context with `isExpanded: true` for its own subtree.
  const contextValue = { ...appShell, isExpanded: appShell.sidebarExpanded }

  // Export/PDF render: only the main content, no chrome, at natural height so the
  // page flows and paginates. The providers stay mounted so content that reads the
  // shell context or fires a toast doesn't break.
  if (exportMode) {
    return (
      <Toast>
        <AppShellContext value={contextValue}>
          <main className="min-h-screen bg-surface-base">{children}</main>
        </AppShellContext>
        <Toast.Viewport />
      </Toast>
    )
  }

  return (
    <Toast>
      <AppShellContext value={contextValue}>
        {/* Frame height yields to the PostHog notification bar when one is
            active: the site app sets --notification-bar-offset on <html>
            (CORE-1015) and body gains matching padding-top in globals.css,
            so the fixed bar effectively participates in the shell's column
            flow like the banner slot. Resolves to h-screen when unset. */}
        <div className="flex h-[calc(100vh-var(--notification-bar-offset,0px))] flex-col bg-surface-base">
          {banner}
          <div className="flex min-h-0 flex-1">
            {nav}
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <div className="page my-2 mr-2 flex flex-1 flex-col rounded-page">
                {topbar}
                <main className="relative z-content flex-1 overflow-y-auto bg-surface-raised scrollbar-track-raised has-data-sticky-table:flex has-data-sticky-table:min-h-0 has-data-sticky-table:flex-col has-data-sticky-table:overflow-hidden">
                  {children}
                </main>
              </div>
            </div>
          </div>
        </div>
      </AppShellContext>
      <Toast.Viewport />
    </Toast>
  )
}

// ---------------------------------------------------------------------------
// NavHeader (internal — always rendered by Nav, not placed by consumer)
// ---------------------------------------------------------------------------

function BrandedLogo({ brandingLogo }: { brandingLogo: BrandingLogo }) {
  const [imgError, setImgError] = useState(false)
  const { isExpanded } = useAppShellContext()

  if (imgError) {
    return <LogoAnimated expanded={isExpanded} />
  }

  const lightUrl = brandingLogo.light ?? brandingLogo.dark ?? null
  const darkUrl = brandingLogo.dark ?? brandingLogo.light ?? null

  if (!lightUrl && !darkUrl) {
    return <LogoAnimated expanded={isExpanded} />
  }

  function handleError() {
    setImgError(true)
  }

  return (
    <div className={cn('flex items-center justify-center', isExpanded ? 'h-10' : 'h-8')}>
      {lightUrl && (
        <Image
          src={lightUrl}
          alt="Logo"
          width={0}
          height={0}
          sizes="100%"
          unoptimized
          className={cn('h-full w-auto object-contain', darkUrl && 'dark:hidden')}
          onError={handleError}
        />
      )}
      {darkUrl && (
        <Image
          src={darkUrl}
          alt="Logo"
          width={0}
          height={0}
          sizes="100%"
          unoptimized
          className={cn('h-full w-auto object-contain', lightUrl ? 'hidden dark:block' : '')}
          onError={handleError}
        />
      )}
    </div>
  )
}

function NavHeader({
  brandingLogo,
  href = '/',
}: {
  brandingLogo?: BrandingLogo | null
  href?: string
}) {
  const { isExpanded } = useAppShellContext()
  const hasBranding = brandingLogo?.light || brandingLogo?.dark

  return (
    <div
      className={cn(
        'flex h-12 flex-shrink-0 items-center justify-center pt-2 transition-[padding] duration-200 ease-in-out',
        isExpanded && 'pt-4',
      )}
    >
      <Link href={href} aria-label="Home">
        {hasBranding ? (
          <BrandedLogo brandingLogo={brandingLogo!} />
        ) : (
          <LogoAnimated expanded={isExpanded} />
        )}
      </Link>
    </div>
  )
}

// ---------------------------------------------------------------------------
// NavGroup
// ---------------------------------------------------------------------------

/**
 * Builds a nav item's LINK href: fixed `defaultParams` first, then params copied from the
 * current URL (`preserveParams`, which override a same-named default). Pure so it can run inside
 * `Children.map`. The bare `href` is used for active matching, never this.
 */
function appendPreservedParams(
  href: string,
  preserveParams: string[] | undefined,
  searchParams: URLSearchParams,
  defaultParams?: string,
): string {
  if (!preserveParams?.length && !defaultParams) return href
  const carried = new URLSearchParams(defaultParams ?? '')
  if (preserveParams?.length) {
    for (const key of preserveParams) {
      const value = searchParams.get(key)
      if (value !== null) carried.set(key, value)
    }
  }
  const query = carried.toString()
  return query ? `${href}?${query}` : href
}

function carriesQueryParams(
  preserveParams: string[] | undefined,
  defaultParams: string | undefined,
): boolean {
  return Boolean(preserveParams?.length || defaultParams)
}

function childrenCarryQueryParams(children: ReactNode): boolean {
  let carry = false
  Children.forEach(children, (child) => {
    if (carry || !isValidElement(child)) return
    const props = child.props as Pick<NavItemProps, 'preserveParams' | 'defaultParams'>
    if (carriesQueryParams(props.preserveParams, props.defaultParams)) {
      carry = true
    }
  })
  return carry
}

const EMPTY_SEARCH_PARAMS = new URLSearchParams()

function hasActiveChild(children: ReactNode, pathname: string): boolean {
  let active = false
  Children.forEach(children, (child) => {
    if (active) return
    if (!isValidElement(child)) return
    const { href, disabled } = child.props as { href?: string; disabled?: boolean }
    if (disabled) return
    if (href && (pathname === href || pathname.startsWith(href + '/'))) {
      active = true
    }
  })
  return active
}

export function NavGroup({ id, label, icon, children }: NavGroupProps) {
  const { isExpanded, expandSidebar } = useAppShellContext()
  const pathname = usePathname() ?? ''
  const isActive = hasActiveChild(children, pathname)
  const [openGroups, setOpenGroups] = usePreference<string[]>('sideNav.openGroups', [])
  const isOpen = openGroups.includes(id)
  const autoOpenedRef = useRef(false)

  // Auto-open a group when it becomes active. Tracked via ref so manually
  // collapsing an active group stays collapsed until the user navigates away
  // and back into it. The ref guard makes re-runs from `openGroups` /
  // `setOpenGroups` changes a no-op while the group is already active.
  useEffect(() => {
    if (!isActive) {
      autoOpenedRef.current = false
      return
    }
    if (autoOpenedRef.current) return
    autoOpenedRef.current = true
    if (!openGroups.includes(id)) {
      setOpenGroups([...openGroups, id])
    }
  }, [isActive, id, openGroups, setOpenGroups])

  function toggleGroup(nextOpen: boolean) {
    setOpenGroups(nextOpen ? [...openGroups, id] : openGroups.filter((g) => g !== id))
  }

  function handleExpand() {
    setOpenGroups([id])
    expandSidebar()
  }

  // Collapsed rail — icon only with hover menu.
  // The trigger is a single Base UI button: aria-label, className, and the
  // mouse-only expand handler all live on the trigger directly. Nesting an
  // interactive `<div>` here breaks Base UI's focus management — keyboard users
  // could not enter the popup, and the accessible name landed on the wrong
  // element. `closeDelay` is left at the wrapper default (300ms) so keyboard
  // focus has time to enter the popup before the hover-out timer fires.
  if (!isExpanded) {
    const menu = {
      id,
      label,
      icon,
      isActive,
      handleExpand,
      children,
    }
    if (childrenCarryQueryParams(children)) {
      return (
        <Suspense fallback={null}>
          <CollapsedNavGroupMenuWithSearch {...menu} />
        </Suspense>
      )
    }
    return (
      <CollapsedNavGroupMenu {...menu} searchParams={EMPTY_SEARCH_PARAMS} />
    )
  }

  // Expanded — delegate to UI NavGroup
  return (
    <UINavGroup
      label={label}
      icon={icon}
      open={isOpen}
      onOpenChange={toggleGroup}
      data-testid={`sidebar-${id}-nav-group`}
    >
      {children}
    </UINavGroup>
  )
}

type CollapsedNavGroupMenuProps = {
  id: string
  label: string
  icon: ReactNode
  isActive: boolean
  handleExpand: () => void
  children: ReactNode
  searchParams: URLSearchParams
}

function CollapsedNavGroupMenuWithSearch(
  props: Omit<CollapsedNavGroupMenuProps, 'searchParams'>,
) {
  const searchParams = useSearchParams()
  return <CollapsedNavGroupMenu {...props} searchParams={searchParams} />
}

function CollapsedNavGroupMenu({
  id,
  label,
  icon,
  isActive,
  handleExpand,
  children,
  searchParams,
}: CollapsedNavGroupMenuProps) {
  return (
    <Menu>
      <Menu.Trigger
        openOnHover
        closeDelay={0}
        aria-label={label}
        data-testid={`sidebar-${id}-collapsed-trigger`}
        className={cn(navRow, 'justify-center', isActive && 'text-primary')}
        onClick={(e) => {
          if (e.detail > 0) {
            handleExpand()
          }
        }}
      >
        <span className={iconBox}>{icon}</span>
      </Menu.Trigger>
      <Menu.Content side="right" align="start" data-testid={`sidebar-${id}-collapsed-popup`}>
        <Menu.Group>
          <Menu.GroupLabel>{label}</Menu.GroupLabel>
          {Children.map(children, (child) => {
            if (!isValidElement(child)) return null
            const props = child.props as NavItemProps
            if (props.disabled) {
              return (
                <Menu.Item disabled>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{props.label}</span>
                    {props.disabledReason && (
                      <span className="text-caption text-fg-tertiary">
                        {props.disabledReason}
                      </span>
                    )}
                  </span>
                </Menu.Item>
              )
            }
            return (
              <Menu.Item
                render={
                  <Link
                    href={appendPreservedParams(
                      props.href,
                      props.preserveParams,
                      searchParams,
                      props.defaultParams,
                    )}
                  />
                }
              >
                <span className="flex-1 truncate">{props.label}</span>
                {props.badge !== undefined && (
                  <span
                    className={cn('rounded-full px-1.5 py-px', badgeLabel, 'text-fg-tertiary')}
                  >
                    {props.badge}
                  </span>
                )}
              </Menu.Item>
            )
          })}
        </Menu.Group>
      </Menu.Content>
    </Menu>
  )
}

// ---------------------------------------------------------------------------
// NavItem
// ---------------------------------------------------------------------------

export function NavItem(props: NavItemProps) {
  if (carriesQueryParams(props.preserveParams, props.defaultParams)) {
    return (
      <Suspense fallback={null}>
        <NavItemWithSearchParams {...props} />
      </Suspense>
    )
  }
  return <NavItemView {...props} resolvedHref={props.href} />
}

function NavItemWithSearchParams(props: NavItemProps) {
  const searchParams = useSearchParams()
  const resolvedHref = appendPreservedParams(
    props.href,
    props.preserveParams,
    searchParams,
    props.defaultParams,
  )
  return <NavItemView {...props} resolvedHref={resolvedHref} />
}

function NavItemView({
  href,
  resolvedHref,
  label,
  badge,
  disabled,
  disabledReason,
  active,
}: NavItemProps & { resolvedHref: string }) {
  const pathname = usePathname() ?? ''
  const { isExpanded } = useAppShellContext()
  const isActive = !disabled && (active ?? (pathname === href || pathname.startsWith(href + '/')))

  if (!isExpanded) return null

  return (
    <UINavGroup.Item
      href={resolvedHref}
      active={isActive}
      badge={badge}
      disabled={disabled}
      tooltip={disabledReason}
    >
      {label}
    </UINavGroup.Item>
  )
}

// ---------------------------------------------------------------------------
// NavTenantItem
// ---------------------------------------------------------------------------

/**
 * Logo image with glyph fallback for the tenant item's icon slot. Mirrors
 * `BrandedLogo`'s light/dark handling — the account ships separate light- and
 * dark-mode logo URLs, so render both and let CSS pick by theme (a single
 * light-only logo on the dark sidebar reads as washed-out / grayscale). Falls
 * back to either variant when the other is missing, and to `icon` on load error.
 */
function TenantGlyph({ icon, logo }: { icon: ReactNode; logo?: BrandingLogo | null }) {
  const [imgError, setImgError] = useState(false)
  const lightUrl = logo?.light ?? logo?.dark ?? null
  const darkUrl = logo?.dark ?? logo?.light ?? null

  if ((!lightUrl && !darkUrl) || imgError) {
    return <span className={iconBox}>{icon}</span>
  }

  function handleError() {
    setImgError(true)
  }

  return (
    <span className={iconBox}>
      {lightUrl && (
        <Image
          src={lightUrl}
          alt=""
          width={0}
          height={0}
          sizes="100%"
          unoptimized
          className={cn('h-full w-auto object-contain', darkUrl && 'dark:hidden')}
          onError={handleError}
        />
      )}
      {darkUrl && (
        <Image
          src={darkUrl}
          alt=""
          width={0}
          height={0}
          sizes="100%"
          unoptimized
          className={cn('h-full w-auto object-contain', lightUrl ? 'hidden dark:block' : '')}
          onError={handleError}
        />
      )}
    </span>
  )
}

/**
 * Top-level tenant overview link — the user's account / organization name as a
 * standalone nav entry, not nested in a `NavGroup`.
 *
 * @when A single account-scoped link that should read as the user's "home"
 *   tenant. Driven by `DashboardNavConfig.tenantOverview` (server-resolved
 *   name + href) and rendered above the nav groups in `shell.tsx`.
 * @avoid A bare `NavItem` for this — `NavItem` returns `null` when the sidebar
 *   collapses (its collapsed rail is owned by the enclosing `NavGroup`), so a
 *   group-less item would vanish. This renders in both states, modeled on
 *   `NavAction` for the collapsed `justify-center` icon affordance.
 */
export function NavTenantItem({ href, label, icon, logo, active }: NavTenantItemProps) {
  const pathname = usePathname() ?? ''
  const { isExpanded } = useAppShellContext()
  const isActive = active ?? (pathname === href || pathname.startsWith(href + '/'))

  return (
    <Link
      href={href}
      // Base UI doesn't render this anchor; add explicit tabIndex so Safari
      // (which skips anchors by default) keeps it in the tab order.
      tabIndex={0}
      aria-label={label}
      aria-current={isActive ? 'page' : undefined}
      data-testid="shell-nav-tenant-overview"
      // Match the NavGroup trigger's rhythm (px-input-x + gap-icon + text-body)
      // so the glyph and label sit on the same grid as the group headers below.
      className={cn(
        'interactable subtle flex w-full items-center gap-icon px-input-x py-item-y text-body focus-visible:-outline-offset-2',
        isActive && 'text-primary',
        !isExpanded && 'justify-center',
      )}
    >
      <TenantGlyph icon={icon} logo={logo} />
      {isExpanded && <span className="flex-1 truncate text-left">{label}</span>}
    </Link>
  )
}

// ---------------------------------------------------------------------------
// NavAction
// ---------------------------------------------------------------------------

export function NavAction({ icon, label, onClick }: NavActionProps) {
  const { isExpanded } = useAppShellContext()

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(navRow, !isExpanded && 'justify-center')}
    >
      <span className={iconBox}>{icon}</span>
      {isExpanded && <span className={cn('truncate pl-1.5', itemLabel)}>{label}</span>}
    </button>
  )
}

// ---------------------------------------------------------------------------
// NavFooter
// ---------------------------------------------------------------------------

export function NavFooter({ children }: NavFooterProps) {
  return <div className="flex flex-shrink-0 flex-col gap-action py-action">{children}</div>
}

// ---------------------------------------------------------------------------
// NavToolbar
// ---------------------------------------------------------------------------

export function NavToolbar({ children }: NavToolbarProps) {
  const { isExpanded } = useAppShellContext()

  return (
    <div
      className={cn(
        'flex flex-shrink-0 items-center gap-tight px-tight py-card',
        !isExpanded && 'flex-col',
      )}
    >
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// NavRoot + internal layout helpers
// ---------------------------------------------------------------------------

function splitChildren(children: ReactNode) {
  let footer: ReactNode = null
  let toolbar: ReactNode = null
  const body: ReactNode[] = []

  Children.forEach(children, (child) => {
    if (isValidElement(child) && child.type === NavFooter) {
      footer = child
    } else if (isValidElement(child) && child.type === NavToolbar) {
      toolbar = child
    } else {
      body.push(child)
    }
  })

  return { body, toolbar, footer }
}

/**
 * NavRoot renders both layouts unconditionally; CSS picks which is visible.
 * - Desktop sidebar: `<aside hidden lg:flex>` — collapsed-rail when
 *   `sidebarExpanded` is false, full-width when true.
 * - Mobile drawer: a `<Drawer>` triggered by the topbar's mobile menu button.
 *   The drawer always renders nav in expanded form, so its subtree overrides
 *   the context's `isExpanded` to `true`.
 *
 * No JS branch on viewport. The hydration mismatch this used to cause is
 * gone because the rendered HTML is identical at every viewport.
 */
export function NavRoot({ children, brandingLogo, header, href }: NavRootProps) {
  return (
    <>
      <DesktopNav brandingLogo={brandingLogo} header={header} href={href}>
        {children}
      </DesktopNav>
      <MobileNav brandingLogo={brandingLogo} header={header} href={href}>
        {children}
      </MobileNav>
    </>
  )
}

function DesktopNav({ children, brandingLogo, header, href }: NavRootProps) {
  const { sidebarExpanded } = useAppShellContext()
  const { body, toolbar, footer } = splitChildren(children)

  return (
    <aside
      className={cn(
        'relative z-chrome hidden h-full flex-col px-action transition-[width] duration-200 ease-in-out lg:flex',
        sidebarExpanded ? 'w-sidebar-expanded' : 'w-sidebar-collapsed',
      )}
      aria-label="Navigation"
    >
      {header ?? <NavHeader brandingLogo={brandingLogo} href={href} />}
      {toolbar}
      <nav
        aria-label="Main navigation"
        className="scroll-fade flex flex-1 flex-col gap-action overflow-y-auto pb-action pt-region-y"
      >
        {body}
      </nav>
      {footer}
      <SidebarRail />
    </aside>
  )
}

/**
 * Thin clickable strip on the right edge of the desktop sidebar. The
 * entire vertical edge is one button — clicking anywhere along it toggles
 * expansion. A faint `GripVertical` icon at the vertical center is
 * always visible (low opacity), brightening on hover so the affordance
 * is discoverable without dominating the sidebar.
 *
 * a11y:
 * - `<button>` with `aria-label` (toggles per state) — keyboard-activable.
 * - `focus-visible` ring + background fill makes the focus state
 *   unambiguous despite the thin element.
 * - Hidden on mobile/tablet — the drawer toggle in the topbar is the
 *   reachable affordance there.
 */
function SidebarRail() {
  const { sidebarExpanded, toggleSidebar } = useAppShellContext()
  return (
    <button
      type="button"
      onClick={toggleSidebar}
      // Safari can skip absolutely-positioned buttons with no visible text
      // content from sequential tab navigation. Explicit tabIndex={0} forces
      // the rail into the tab order to match Chrome/Firefox.
      tabIndex={0}
      aria-label={sidebarExpanded ? 'Collapse navigation' : 'Expand navigation'}
      title={sidebarExpanded ? 'Collapse navigation' : 'Expand navigation'}
      className={cn(
        'group absolute inset-y-0 right-0 z-chrome w-2 cursor-ew-resize transition-colors',
        'hover:bg-interactive-hover',
        'focus-visible:bg-interactive-hover focus-visible:outline-none',
        'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset',
      )}
    >
      <GripVertical
        aria-hidden
        className={cn(
          'absolute left-1/2 top-1/2 size-icon-lg -translate-x-1/2 -translate-y-1/2',
          'text-fg-muted/40 transition-colors',
          'group-hover:text-fg-tertiary group-focus-visible:text-fg-tertiary',
        )}
      />
    </button>
  )
}

function MobileNav({ children, brandingLogo, header, href }: NavRootProps) {
  const ctx = useAppShellContext()
  const { body, toolbar, footer } = splitChildren(children)

  // Drawer always renders nav in full expanded form. Override the context
  // for this subtree so nav sub-components reading `isExpanded` render the
  // expanded layout regardless of the desktop sidebar preference.
  const drawerContext = { ...ctx, isExpanded: true }

  function handleOpenChange(open: boolean) {
    if (!open) ctx.closeDrawer()
  }

  return (
    <Drawer open={ctx.drawerOpen} onOpenChange={handleOpenChange}>
      <Drawer.Content
        side="left"
        className="w-sidebar-expanded bg-surface-raised px-action lg:hidden"
        aria-label="Navigation"
        data-testid="sidebar-mobile-drawer"
      >
        <AppShellContext value={drawerContext}>
          <div className="flex items-center justify-between">
            {header ?? <NavHeader brandingLogo={brandingLogo} href={href} />}
            <Drawer.Close />
          </div>
          {toolbar}
          <nav className="scroll-fade flex flex-1 flex-col gap-action overflow-y-auto pb-action pt-region-y">
            {body}
          </nav>
          {footer}
        </AppShellContext>
      </Drawer.Content>
    </Drawer>
  )
}

// ---------------------------------------------------------------------------
// Topbar
// ---------------------------------------------------------------------------

/**
 * Topbar chrome. The mobile drawer toggle lives here because the drawer
 * itself is hidden — its trigger has to be reachable from outside it.
 * The desktop sidebar collapse toggle lives on the sidebar (see
 * `SidebarRail` above); on desktop the topbar is just
 * `[breadcrumb / page chrome] [actions]`.
 */
export function TopbarRoot({ children }: TopbarRootProps) {
  const { drawerOpen, toggleDrawer } = useAppShellContext()

  return (
    <header
      aria-label="Top bar"
      className="relative z-chrome flex flex-shrink-0 items-center gap-region border-b border-border px-region-x py-region-y"
    >
      <IconButton
        className="lg:hidden"
        icon={drawerOpen ? <X /> : <MenuIcon />}
        aria-label={drawerOpen ? 'Close navigation' : 'Open navigation'}
        onClick={toggleDrawer}
        data-testid="topbar-mobile-drawer-toggle"
      />
      {children}
    </header>
  )
}

export function TopbarActions({ children }: TopbarActionsProps) {
  return <div className="ml-auto flex items-center gap-action">{children}</div>
}
