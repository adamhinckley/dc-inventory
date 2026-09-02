import { RotateCw } from 'lucide-react'
import { LoadingButton } from '#ds/ui/LoadingButton'
import { cn } from '#cn'

export interface ErrorStateProps {
  title?: string
  message?: string
  onRetry?: () => void
  /**
   * The retry is in flight — the "Try Again" button shows its loading state.
   * Wire to the backing query's `isFetching`: after a retry click the query
   * stays `isError: true` until it resolves, so without this a slow retry
   * reads as a dead button.
   */
  retrying?: boolean
  className?: string
  /** Optional. Format: `{feature}-{view}-{element}`. See `.claude/rules/concepts/testid.md`. */
  'data-testid'?: string
}

/**
 * Centered error display with optional retry button. Used by `ErrorBoundary`
 * as the default fallback and as a manual placeholder in panels/tables when
 * a query fails.
 *
 * @when In-place failure UI — query error states, panel-level failures,
 *   `ErrorBoundary` fallback.
 * @avoid Transient errors that should auto-resolve (network blips) — toast
 *   them via `useToast` and let the component render its data when the
 *   retry succeeds.
 */
export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  retrying = false,
  className,
  'data-testid': testid,
}: ErrorStateProps) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center gap-3 py-12 text-center', className)}
      data-testid={testid}
    >
      <h2 className="section-content-title">{title}</h2>
      {message && <p className="text-placeholder max-w-sm">{message}</p>}
      {onRetry && (
        <LoadingButton
          variant="default"
          size="sm"
          loading={retrying}
          onClick={onRetry}
          data-testid={testid ? `${testid}-retry` : 'error-state-retry'}
        >
          <RotateCw className="size-icon" aria-hidden />
          Try Again
        </LoadingButton>
      )}
    </div>
  )
}
