export type { ErrorStateProps } from './ErrorState'

/**
 * Centered error display with optional retry button. Used by
 * `ErrorBoundary` as the default fallback and as a manual placeholder
 * in panels/tables when a query fails.
 *
 * @when In-place failure UI — query error states, panel-level failures,
 *   `ErrorBoundary` fallback content.
 * @avoid Transient errors that should auto-resolve (network blips) —
 *   toast them via `useToast` and let the component render its data
 *   when retry succeeds. Next route errors — use `RouteError`.
 */
export { ErrorState } from './ErrorState'
