export type { IconButtonProps } from './IconButton'

/**
 * Icon-only button. Centers an icon inside an interactable surface.
 *
 * @when Compact actions where the icon carries the meaning — kebab
 *   triggers, table-row actions, close/dismiss controls. Always pair
 *   with `aria-label`.
 * @avoid Actions with a text label — use `Button` (which accepts a
 *   leading icon via `gap-icon`).
 * @variants variant (filled · subtle · ghost), shape (square · circle),
 *   size (sm · md · lg)
 */
export { IconButton } from './IconButton'
