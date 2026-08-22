import { RouterTabsRoot, RouterTabsList, RouterTabsTrigger, RouterTabsPanel } from './RouterTabs'

export type {
  RouterTabsRootProps as RouterTabsProps,
  RouterTabsListProps,
  RouterTabsTriggerProps,
} from './RouterTabs'

/**
 * URL-driven tabs. The default tabbing primitive for the app — each trigger
 * is a `<Link>`, the active tab is derived from `usePathname()`, and routing
 * is the source of truth. Filter state, browser history, and shareable links
 * all "just work" because every tab change is a real navigation.
 *
 * Visually similar to `Tabs` but skips the animated underline transition
 * (intentional — route changes mask the animation, and avoiding it keeps a
 * navigation-driven control off Base UI's tab internals). Don't "fix" this.
 *
 * @when Anywhere a user might want to deep-link, share, or navigate back to
 *   a specific tab — page-level tabs, detail-page sub-resources, anything
 *   in the route tree (`/accounts/[id]`, `/accounts/[id]/users`). If you
 *   aren't sure, use this.
 * @avoid Ephemeral inline switches that intentionally should NOT update the
 *   URL — content inside a dialog, side panel, or widget where the tab
 *   choice isn't worth a deep link. Those are the rare cases for `Tabs`.
 */
export const RouterTabs = Object.assign(RouterTabsRoot, {
  List: RouterTabsList,
  Trigger: RouterTabsTrigger,
  Panel: RouterTabsPanel,
})
