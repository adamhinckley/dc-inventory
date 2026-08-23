/**
 * Button for actions that trigger an async operation. While `loading`, it
 * auto-disables, sets `aria-busy`, and swaps content for a spinner (or a
 * custom `loadingContent` node).
 *
 * @when Any clickable action that kicks off async work — form submits, save
 *   buttons, async row actions, mutations. Use whenever a click triggers a
 *   request that needs in-flight feedback.
 * @avoid Synchronous actions (toggling local state, opening a dialog) — use
 *   `Button`. Icon-only async triggers — use `IconButton` and wire loading
 *   state yourself.
 * @variants Inherits `Button` variants (`default`/`primary`/`secondary`/`ghost`/`destructive`)
 *   and sizes (`sm`/`md`/`lg`).
 */
export { LoadingButton, type LoadingButtonProps } from './LoadingButton'
