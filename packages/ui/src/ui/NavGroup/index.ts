import { NavGroupRoot, NavGroupItem } from './NavGroup'

export type { NavGroupProps, NavGroupItemProps } from './NavGroup'

/**
 * Labeled sidebar nav section. Groups nav items under a named heading with
 * active state indicators.
 *
 * @when Sidebars that organize links into named sections (e.g., "EXPOSURE",
 *   "SOC", "ADMIN"). One NavGroup per section.
 * @avoid Horizontal navigation, dropdown menus, or any grouped list that
 *   isn't navigation.
 * @variants `NavGroup.Item` carries `active` (true/false) for the
 *   current-page indicator.
 */
export const NavGroup = Object.assign(NavGroupRoot, { Item: NavGroupItem })
