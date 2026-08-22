import type { ReactNode } from 'react'
import { Button, type ButtonProps } from '#ds/ui/Button'
import { Spinner } from '#ds/ui/Spinner'
import { cn } from '#cn'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface LoadingButtonProps extends ButtonProps {
  /** When true: disables the button, announces `aria-busy`, and swaps content for the loading indicator. */
  loading?: boolean
  /** Replaces the default `Spinner` while `loading` is true. Pass text ("Saving…") or a custom node. */
  loadingContent?: ReactNode
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Button for actions that trigger an async operation. While `loading`, it
 * auto-disables, sets `aria-busy`, and swaps its content for a `Spinner` (or
 * `loadingContent` if provided).
 *
 * @when Any clickable action that kicks off async work — form submits, save
 *   buttons, async row actions, mutations. Reach for this whenever a click
 *   triggers a request that needs in-flight feedback.
 * @avoid Synchronous actions (toggling local state, opening a dialog) — use
 *   `Button`. Icon-only async triggers — use `IconButton` and wire the
 *   loading state yourself.
 * @variants Inherits all `Button` variants (`default`/`primary`/`secondary`/`ghost`/`destructive`)
 *   and sizes (`sm`/`md`/`lg`).
 */
export function LoadingButton({
  ref,
  loading = false,
  loadingContent,
  disabled,
  children,
  ...rest
}: LoadingButtonProps) {
  return (
    <Button ref={ref} disabled={disabled || loading} {...rest} aria-busy={loading || undefined}>
      <span className="grid">
        <span
          className={cn(
            'col-start-1 row-start-1 inline-flex items-center justify-center gap-icon',
            loading && 'invisible',
          )}
        >
          {children}
        </span>
        <span
          className={cn(
            'col-start-1 row-start-1 inline-flex items-center justify-center',
            !loading && 'invisible',
          )}
          aria-hidden={!loading}
        >
          {loadingContent ?? (
            <Spinner size="sm" className="size-3.5 border-current/25 border-t-current" />
          )}
        </span>
      </span>
    </Button>
  )
}
