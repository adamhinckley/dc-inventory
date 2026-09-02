import type { ComponentPropsWithRef, ReactNode } from 'react'
import { cn } from '#cn'

export interface DevCommentProps extends ComponentPropsWithRef<'p'> {
  children: ReactNode
  /**
   * Which edge of the positioned parent the note hangs from.
   * Parent must be `relative` (the control you drop this next to).
   */
  align?: 'start' | 'end'
  /** Hang above or below the parent. */
  placement?: 'above' | 'below'
}

/**
 * Out-of-flow scratch note. Absolutely positioned under its `relative`
 * parent so it never shifts layout. Bold italic caution (orange), one line.
 *
 * @when Open layout questions, "decide later" callouts while building a screen.
 * @avoid User-facing help — use `TooltipHelp`. Validation — use `Form` errors.
 */
export function DevComment({
  children,
  className,
  align = 'start',
  placement = 'below',
  ref,
  ...rest
}: DevCommentProps) {
  return (
    <p
      ref={ref}
      role="note"
      className={cn(
        'pointer-events-none absolute z-popover whitespace-nowrap text-body-sm font-bold italic text-caution',
        placement === 'above' ? 'bottom-full mb-tight' : 'top-full mt-tight',
        align === 'end' ? 'right-0' : 'left-0',
        className,
      )}
      {...rest}
    >
      {children}
    </p>
  )
}
