/**
 * Standard button. Five visual variants and four sizes.
 *
 * Labels are always Title Case and bold. On a page that hosts a table with
 * actions, every Button includes a leading lucide icon. Do not override
 * `font-bold` or pass sentence-case copy.
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
 *   size (`xs`/`sm`/`md`/`lg`). `md` matches `--space-input-height`.
 */
export { Button, buttonVariants, type ButtonProps } from './Button'
