import {
  MenuRoot,
  MenuTrigger,
  MenuContent,
  MenuItem,
  MenuGroup,
  MenuGroupLabel,
  MenuSeparator,
} from './Menu'

/**
 * Dropdown menu. Floating list of selectable actions anchored to a trigger,
 * with keyboard navigation and focus management from Base UI.
 *
 * @when Action menus on a row, kebab menus, settings menus — short lists of
 *   commands the user picks one of and dismisses.
 * @avoid Free-form floating content (filters, forms, rich popups) — use
 *   `Popover`. Tab-style navigation between sibling views — use `Tabs`.
 */
export const Menu = Object.assign(MenuRoot, {
  Trigger: MenuTrigger,
  Content: MenuContent,
  Item: MenuItem,
  Group: MenuGroup,
  GroupLabel: MenuGroupLabel,
  Separator: MenuSeparator,
})
