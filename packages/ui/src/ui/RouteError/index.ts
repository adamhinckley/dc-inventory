export type { RouteErrorProps } from './RouteError'

/**
 * Standardized fallback UI for Next.js route error boundaries
 * (`error.tsx`). Formats the digest as a support reference and renders
 * `ErrorState` with `reset` wired as the retry handler.
 *
 * @when Default export inside any `error.tsx` route file. Pass a
 *   route-scoped message ending in a period.
 * @avoid Inline panel/table errors where you have your own refetch
 *   callback — use `ErrorState` directly. Render-time errors outside the
 *   Next route contract — use `ErrorBoundary`.
 */
export { RouteError } from './RouteError'
