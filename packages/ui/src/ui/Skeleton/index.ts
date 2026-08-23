export type { SkeletonProps } from './Skeleton'

/**
 * Pulsing inline placeholder for content that's still loading.
 * `aria-hidden` — the loading state is communicated semantically by the
 * wrapping component (`Title isPending`, table loading row).
 *
 * @when Inline loading placeholders for text or value cells where you
 *   want layout to settle before data arrives.
 * @avoid Wrapping a whole route in skeletons — prefer the layout's own
 *   loading state (table empty/loading row, page-level pending markers).
 */
export { Skeleton } from './Skeleton'
