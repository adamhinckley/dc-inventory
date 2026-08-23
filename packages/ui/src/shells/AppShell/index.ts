'use client'

import {
  AppShellRoot,
  NavRoot,
  NavGroup,
  NavItem,
  NavTenantItem,
  NavAction,
  NavFooter,
  NavToolbar,
  TopbarRoot,
  TopbarActions,
} from './AppShell'

/**
 * Dashboard application shell. Sidebar nav + topbar + elevated page panel,
 * plus the toast viewport. Mounts once per dashboard route group.
 *
 * @when Every authenticated dashboard route. Compose with `AppShell.Nav`,
 *   `AppShell.NavGroup`/`NavItem`, `AppShell.Topbar`, and feature-level
 *   page content as `children`.
 * @avoid Public/marketing pages and minimal auth screens — they should use
 *   their own shell or no shell. Embedding routing logic here — shells are
 *   chrome, not routing.
 */
export const AppShell = Object.assign(AppShellRoot, {
  Nav: NavRoot,
  NavGroup: NavGroup,
  NavItem: NavItem,
  NavTenantItem: NavTenantItem,
  NavAction: NavAction,
  NavFooter: NavFooter,
  NavToolbar: NavToolbar,
  Topbar: TopbarRoot,
  TopbarActions: TopbarActions,
})

export { useAppShellContext } from './AppShell.context'
export { iconBox, itemLabel, navRow } from './AppShell'
export type { BrandingLogo } from './AppShell'
