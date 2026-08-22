'use client'

import { useState } from 'react'
import { useBreakpoint } from '#shared/hooks/use-breakpoint'
import { usePreference } from '#shared/hooks/use-preference'

export interface UseAppShellReturn {
  /**
   * Desktop sidebar collapse state, persisted to localStorage. Read this
   * directly only inside the desktop sidebar subtree; nav sub-components
   * should consume `isExpanded` from context, which resolves correctly
   * inside both the sidebar and the mobile drawer.
   */
  sidebarExpanded: boolean
  toggleSidebar: () => void
  expandSidebar: () => void

  /**
   * Mobile/tablet drawer open state, transient (not persisted). Auto-closes
   * when the viewport crosses to desktop so the drawer can't linger off-screen.
   */
  drawerOpen: boolean
  openDrawer: () => void
  closeDrawer: () => void
  toggleDrawer: () => void
}

/**
 * Layout decisions in the shell are CSS-driven (responsive utility classes);
 * this hook only owns *state* — the desktop sidebar's collapse preference
 * and the mobile drawer's open flag. Two distinct concerns with different
 * lifecycles (persisted vs transient), so they're separate variables.
 *
 * `useBreakpoint` is read here only to auto-close the drawer when the
 * viewport crosses into desktop, so the drawer doesn't stay rendered
 * off-screen if the user resizes mid-session.
 */
export function useAppShell(): UseAppShellReturn {
  const [sidebarExpanded, setSidebarExpanded] = usePreference('sideNav.expanded', true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const breakpoint = useBreakpoint()

  // Close the drawer when the viewport becomes desktop. The drawer trigger
  // is CSS-hidden at desktop, so the user can't open or close it from the
  // chrome — auto-close keeps state consistent with what's reachable. Done
  // during render (not in an effect) so React drops the in-progress render
  // and re-renders before commit, avoiding the cascading commit a
  // setState-in-effect would produce.
  if (breakpoint === 'desktop' && drawerOpen) {
    setDrawerOpen(false)
  }

  return {
    sidebarExpanded,
    toggleSidebar: () => setSidebarExpanded(!sidebarExpanded),
    expandSidebar: () => setSidebarExpanded(true),
    drawerOpen,
    openDrawer: () => setDrawerOpen(true),
    closeDrawer: () => setDrawerOpen(false),
    toggleDrawer: () => setDrawerOpen(!drawerOpen),
  }
}
