/**
 * Standard button. Five visual variants and three sizes.
 *
 * @when Any clickable action — primary CTAs, cancel buttons, toolbar
 *   actions, submit/cancel pairs in dialogs.
 * @avoid Async operations (form submits, save buttons, mutations) — use
 *   `LoadingButton`, which auto-disables, sets `aria-busy`, and shows a
 *   spinner while in flight. Icon-only triggers (kebab menus, close
 *   buttons) — use `IconButton`. Wrapping a Base UI Trigger (Dialog/Menu/
 *   Popover) — those render their own `<button>`; pass styling directly to
 *   the Trigger instead of nesting a Button.
 * @variants variant (`default`/`primary`/`secondary`/`ghost`/`destructive`),
 *   size (`sm`/`md`/`lg`)
 */
export { Button, buttonVariants, type ButtonProps } from './Button'
