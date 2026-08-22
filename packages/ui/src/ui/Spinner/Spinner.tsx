import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '#cn'

// ---------------------------------------------------------------------------
// Variants
// ---------------------------------------------------------------------------

const spinnerVariants = cva('animate-spin rounded-full border-2 border-border border-t-primary', {
  variants: {
    size: {
      sm: 'size-4',
      md: 'size-6',
      lg: 'size-8',
    },
  },
  defaultVariants: { size: 'sm' },
})

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SpinnerProps extends VariantProps<typeof spinnerVariants> {
  className?: string
  label?: string
  /** Optional. Format: `{feature}-{view}-{element}`. See `.claude/rules/concepts/testid.md`. */
  'data-testid'?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Animated loading spinner. Indeterminate progress indicator that announces
 * itself via `role="status"` with the supplied `label`.
 *
 * @when In-flight feedback for a localized async action — submit button
 *   pending state, panel-level loading, polling indicators.
 * @avoid Page-level loading where layout should settle before data arrives —
 *   use `Skeleton` placeholders so the page doesn't shift.
 * @variants size (`sm`/`md`/`lg`)
 */
export function Spinner({
  size,
  className,
  label = 'Loading',
  'data-testid': testid,
}: SpinnerProps) {
  return (
    <div
      className={cn(spinnerVariants({ size }), className)}
      role="status"
      aria-label={label}
      data-testid={testid}
    />
  )
}
