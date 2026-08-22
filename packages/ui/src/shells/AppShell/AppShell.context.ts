'use client'

import { createContext, useContext } from 'react'
import type { UseAppShellReturn } from './AppShell.hook'

/**
 * Context value exposed to nav sub-components.
 *
 * `isExpanded` is the **local** "is this nav rendering in expanded form?"
 * flag — `sidebarExpanded` inside the desktop sidebar subtree, hardcoded
 * `true` inside the mobile drawer subtree (the drawer always renders nav
 * full-width when open). Read `isExpanded` from context — never read
 * `sidebarExpanded` directly inside a nav sub-component, or it'll render
 * collapsed-rail UI inside the mobile drawer.
 */
export interface AppShellContextValue extends UseAppShellReturn {
  isExpanded: boolean
}

export const AppShellContext = createContext<AppShellContextValue | null>(null)

export function useAppShellContext(): AppShellContextValue {
  const ctx = useContext(AppShellContext)
  if (!ctx) {
    throw new Error('useAppShellContext must be used within an AppShell')
  }
  return ctx
}
