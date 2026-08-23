import { TabsRoot, TabsList, TabsTrigger, TabsPanel } from './Tabs'

export type { TabsRootProps, TabsListProps, TabsTriggerProps, TabsPanelProps } from './Tabs'

/**
 * Non-routed tabbed view switcher. Active tab is held in component state, not
 * the URL — keyboard-navigable, with panels that stay mounted by default to
 * preserve in-tab state (filters, scroll, queries).
 *
 * @when **Only** when the active tab should NOT be reflected in the URL —
 *   ephemeral inline switches inside a dialog, side panel, or widget where
 *   the tab choice isn't worth a deep link or back-button entry.
 * @avoid Anything where the URL should reflect the active tab — use
 *   `RouterTabs` (the default for any page-level tabbing). If you're not
 *   sure, use `RouterTabs` — shareable URLs and browser history are almost
 *   always the right behavior. Also avoid for action menus — use `Menu`.
 */
export const Tabs = Object.assign(TabsRoot, {
  List: TabsList,
  Trigger: TabsTrigger,
  Panel: TabsPanel,
})
