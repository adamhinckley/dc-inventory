export type { TooltipHelpProps } from './TooltipHelp'

/**
 * Help-icon tooltip. Wraps Base UI's Tooltip with a default
 * `HelpCircle` trigger and overlay-token styling. Hover or focus the
 * trigger to reveal.
 *
 * @when Inline help adjacent to form labels, settings, or table headers
 *   where the surrounding label is too dense to expand.
 * @avoid Long-form content — use `Popover`. Toggleable info — use a
 *   `Dialog`. Replacing the rendered button via `render` — that
 *   disconnects Base UI's hover/focus event wiring and the tooltip
 *   silently stops opening.
 */
export { TooltipHelp } from './TooltipHelp'
