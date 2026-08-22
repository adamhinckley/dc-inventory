import type { ComponentPropsWithRef } from 'react'
import { cn } from '#cn'

export type SkeletonProps = ComponentPropsWithRef<'span'>

/**
 * Pulsing placeholder for content that's still loading. `aria-hidden` since
 * the loading state is communicated semantically by the wrapping component
 * (`Title isPending`, table loading row).
 *
 * @when Inline loading placeholders for text or value cells where you want
 *   layout to settle before data arrives.
 * @avoid Wrapping a whole route in skeletons — prefer the layout's own
 *   loading state (table empty/loading row, page-level pending markers).
 */
export function Skeleton({ className, ref, ...rest }: SkeletonProps) {
  return (
    <span
      ref={ref}
      aria-hidden
      className={cn('inline-block animate-pulse rounded bg-interactive-hover', className)}
      {...rest}
    />
  )
}
