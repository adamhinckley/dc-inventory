import type { ComponentPropsWithRef } from 'react'
import { cn } from '#cn'
import './AllocationMeter.css'

export interface AllocationMeterProps extends ComponentPropsWithRef<'div'> {
  /** Total capacity the track represents; fills are measured against it. */
  max: number
  /** Committed amount — the solid fill from the left. */
  value: number
  /**
   * A pending change, shown as a striped segment immediately after the fill
   * (a preview of what will change on commit). Defaults to `0` (no stripe).
   */
  pending?: number
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(n, max))
}

/**
 * Horizontal allocation meter — a fixed track (the capacity) with a solid fill
 * (what's committed) and an optional striped segment (a pending change staged
 * but not yet committed). Single hue: direction (add vs remove) is not encoded
 * in color, so a decrease never reads as an error — the caller conveys it with
 * the geometry and an adjacent signed label.
 *
 * Presentational and unitless: it knows nothing about what's being allocated.
 * The caller maps its domain onto `max` / `value` / `pending`.
 *
 * Width comes from the caller (`className`, e.g. `flex-1` or `w-40`); the track
 * owns only its height. The bar is decorative — pass `aria-hidden` when the
 * numbers are already stated nearby, or `role="meter"` + `aria-*` when it's the
 * sole representation.
 *
 * @when Showing how much of a fixed capacity is used with a staged change:
 *   license pool ↔ delegated (its origin), storage used + pending upload,
 *   budget spent + pending.
 * @avoid Task-completion / work-in-flight indicators — use `Progress`. Encoding
 *   good/bad with color — this is single-hue by design.
 * @tokens bg-interactive (track), bg-primary (fill), --color-primary (stripe)
 * @example
 * <AllocationMeter className="flex-1" max={total + pool} value={current} pending={delta} aria-hidden />
 */
export function AllocationMeter({
  ref,
  max,
  value,
  pending = 0,
  className,
  ...rest
}: AllocationMeterProps) {
  const valueClamped = max > 0 ? clamp(value, 0, max) : 0
  // Cap the stripe at the space left after the fill so the two never overflow.
  const pendingClamped = max > 0 ? clamp(pending, 0, max - valueClamped) : 0
  const valuePct = max > 0 ? (valueClamped / max) * 100 : 0
  const pendingPct = max > 0 ? (pendingClamped / max) * 100 : 0

  return (
    <div
      ref={ref}
      className={cn('flex h-2.5 overflow-hidden rounded-full bg-interactive', className)}
      {...rest}
    >
      <div
        className="bg-primary transition-[width] duration-200 ease-out motion-reduce:transition-none"
        style={{ width: `${valuePct}%` }}
      />
      {pendingClamped > 0 && (
        <div
          className="allocation-meter-pending transition-[width] duration-200 ease-out motion-reduce:transition-none"
          style={{ width: `${pendingPct}%` }}
        />
      )}
    </div>
  )
}
