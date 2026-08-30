import type { ComponentPropsWithRef } from 'react'
import { Progress as BaseProgress } from '@base-ui-components/react/progress'
import { cn } from '#cn'
import './Progress.css'

export interface ProgressProps extends ComponentPropsWithRef<'div'> {
  /**
   * `0`–`100` for determinate fill. Omit (or `null`) for an indeterminate
   * sweep — the bar shows "something is happening" without claiming a
   * known duration.
   */
  value?: number | null
}

/**
 * Thin (2px) progress bar. Two modes:
 *
 * - **Indeterminate** (default): a sweeping highlight signals work in
 *   flight without claiming a known duration.
 * - **Determinate** (`value` 0–100): the indicator fills from the left
 *   to the given percentage.
 *
 * Renders nothing structural — positioning (absolute over a border,
 * sticky atop a table, fixed at the top of the page) is the consumer's
 * job. Wraps Base UI's `Progress.Root` so `role="progressbar"` and ARIA
 * semantics come along for free. Pass `aria-hidden` when the busy state
 * is already communicated by surrounding UI (disabled controls, status
 * text).
 *
 * @when Background mutation or refetch indicators (indeterminate) where
 *   per-element skeletons would over-clutter; long-running operations
 *   reporting % complete (determinate) — uploads, exports.
 * @avoid Persistent always-on indicators — only render while work is in
 *   flight.
 * @example
 * <Dialog.Footer className="relative">
 *   {busy && (
 *     <Progress aria-hidden className="absolute -top-px inset-x-0" />
 *   )}
 *   <Button>Close</Button>
 * </Dialog.Footer>
 *
 * @example
 * <Progress value={uploadPercent} aria-label="Upload progress" />
 */
export function Progress({ value = null, className, ref, ...rest }: ProgressProps) {
  const isIndeterminate = value === null
  return (
    <BaseProgress.Root
      ref={ref}
      value={value}
      className={cn('h-0.5 overflow-hidden', className)}
      {...rest}
    >
      <BaseProgress.Track className="relative h-full w-full">
        <BaseProgress.Indicator
          className={cn(
            'bg-primary',
            isIndeterminate
              ? 'absolute inset-y-0 w-1/3 animate-indeterminate-sweep motion-reduce:animate-none'
              : 'h-full transition-[width] duration-200',
          )}
        />
      </BaseProgress.Track>
    </BaseProgress.Root>
  )
}
