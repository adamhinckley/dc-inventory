export type { EmptyStateProps } from './EmptyState'

/**
 * Centered empty-data placeholder with an optional icon badge and CTA — the
 * successful-but-empty counterpart to `ErrorState`. Use when a query resolves
 * with zero rows (a dashboard block with no data for the active filters, an
 * empty tab panel).
 *
 * @when A query succeeded but returned nothing to show. Pair a reassuring icon
 *   with copy explaining why it's empty.
 * @avoid Query FAILURES — use `ErrorState` (carries retry). Loading — use
 *   `Skeleton`.
 */
export { EmptyState } from './EmptyState'
