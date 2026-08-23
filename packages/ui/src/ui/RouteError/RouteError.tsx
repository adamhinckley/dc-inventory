import { ErrorState } from '#ds/ui/ErrorState'

export interface RouteErrorProps {
  /** Error object provided by Next.js to error.tsx files. */
  error: Error & { digest?: string }
  /** Reset callback provided by Next.js to error.tsx files. */
  reset: () => void
  /**
   * Route-scoped user-facing message ending in a period (e.g.,
   * "We couldn't load this account."). The digest reference is appended
   * automatically when Next provides one.
   */
  message: string
  /** Optional. Format: `{feature}-{view}-{element}`. See `.claude/rules/concepts/testid.md`. */
  'data-testid'?: string
}

/**
 * Standardized fallback UI for Next.js route error boundaries (`error.tsx`).
 * Formats the digest as a support reference and renders `ErrorState` with
 * `reset` wired as the retry handler.
 *
 * @when Default export inside any `error.tsx` route file. Pass a
 *   route-scoped message ending in a period (e.g., "We couldn't load this
 *   account.").
 * @avoid Inline panel/table errors where you have your own refetch
 *   callback — use `ErrorState` directly. The `error`/`reset` shape here
 *   matches the Next-provided contract; outside that contract, `ErrorState`
 *   is the right primitive.
 */
export function RouteError({ error, reset, message, 'data-testid': testid }: RouteErrorProps) {
  return (
    <ErrorState
      message={error.digest ? `${message} Reference: ${error.digest}` : message}
      onRetry={reset}
      data-testid={testid}
    />
  )
}
