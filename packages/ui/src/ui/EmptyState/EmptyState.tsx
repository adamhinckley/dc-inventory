import { cva, type VariantProps } from 'class-variance-authority'
import type { ReactNode } from 'react'
import { cn } from '#cn'

const emptyStateVariants = cva('flex', {
  variants: {
    orientation: {
      // Centered column: icon badge above the text, everything centered. The default — fills a
      // chart-sized panel body.
      vertical: 'flex-col items-center justify-center gap-3 py-12 text-center',
      // Compact strip: icon badge beside left-aligned text, for short/dense surfaces (a title-less
      // panel) where the tall centered column wastes vertical space. Collapses BACK to the centered
      // column below `sm` — a narrow panel has no room for the side-by-side strip.
      horizontal:
        'flex-col items-center justify-center gap-3 py-12 text-center sm:flex-row sm:gap-4 sm:py-2 sm:text-left',
    },
  },
  defaultVariants: { orientation: 'vertical' },
})

const emptyStateTextVariants = cva('flex flex-col', {
  variants: {
    orientation: {
      vertical: 'items-center gap-3',
      horizontal: 'items-center gap-3 sm:items-start sm:gap-1',
    },
  },
  defaultVariants: { orientation: 'vertical' },
})

export interface EmptyStateProps extends VariantProps<typeof emptyStateVariants> {
  /**
   * Decorative glyph rendered inside a tinted circular badge — pass a lucide icon element
   * (`<CalendarCheck />`); the badge sizes and colors it. Omit for a text-only empty state.
   * The badge is `aria-hidden`, so the icon never needs its own label.
   */
  icon?: ReactNode
  title: string
  /** Supporting sentence under the title. */
  message?: string
  /** Optional call-to-action (e.g. a `Button`) rendered below the message. */
  action?: ReactNode
  className?: string
  /** Optional. Format: `{feature}-{view}-{element}`. See `.claude/rules/concepts/testid.md`. */
  'data-testid'?: string
}

/**
 * Centered "nothing here (yet)" placeholder with an optional icon badge and CTA — the
 * successful-but-empty counterpart to `ErrorState` (same text roles). Use it when a query
 * resolves with zero rows: a dashboard block with no data for the active filters, an empty tab
 * panel, a not-yet-populated section.
 *
 * `orientation="vertical"` (default) is the centered column for a full-height panel body;
 * `"horizontal"` is a compact left-aligned strip (icon beside text) for short surfaces that
 * collapses back to the centered column below `sm` (a narrow panel can't fit the strip).
 *
 * @when A query succeeded but returned nothing to show. Pair a reassuring icon
 *   (`ShieldCheck`, `CalendarCheck`) with copy that says why it's empty.
 * @avoid Query FAILURES — use `ErrorState` (it carries the retry affordance). Loading —
 *   use `Skeleton`. A failed list must never read as "empty" (see `concepts/errors.md`).
 */
export function EmptyState({
  icon,
  title,
  message,
  action,
  orientation,
  className,
  'data-testid': testid,
}: EmptyStateProps) {
  return (
    <div className={cn(emptyStateVariants({ orientation }), className)} data-testid={testid}>
      {icon && (
        <div
          aria-hidden
          className="flex size-16 shrink-0 items-center justify-center rounded-full border border-info/30 bg-info/10 text-info [&>svg]:size-8"
        >
          {icon}
        </div>
      )}
      <div className={emptyStateTextVariants({ orientation })}>
        <h2 className="section-content-title">{title}</h2>
        {message && <p className="text-placeholder max-w-sm">{message}</p>}
        {action}
      </div>
    </div>
  )
}
