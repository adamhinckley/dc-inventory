import { type ComponentPropsWithRef } from 'react'
import { cn } from '#cn'
import { Chip } from '#ds/ui/Chip'

export interface TagListProps extends Omit<ComponentPropsWithRef<'div'>, 'children'> {
  values: readonly string[] | null | undefined
  /** Rendered when `values` is empty or nullish. Defaults to `null` (renders nothing). */
  emptyFallback?: React.ReactNode
  /**
   * When true, every rendered chip is marked for marker.io PII masking.
   * Use for tag lists whose values are user data (handles, usernames,
   * personal labels). Skip for category / status tags.
   */
  pii?: boolean
}

/**
 * Wraps a string array in `Chip` components, separated by a flex gap.
 * Renders `emptyFallback` (default: nothing) when the array is empty/null.
 *
 * @when Display-only string lists — tags, categories, group memberships in
 *   table cells and detail panels.
 * @avoid Editable tag inputs — render a `Form.Field` with a custom control.
 *   Status (single value) — use `Chip` directly with a status tint.
 */
export function TagList({
  values,
  emptyFallback = null,
  className,
  pii,
  ref,
  ...rest
}: TagListProps) {
  if (!values || values.length === 0) return <>{emptyFallback}</>

  return (
    <div ref={ref} className={cn('flex flex-wrap gap-1', className)} {...rest}>
      {values.map((value) => (
        <Chip key={value} pii={pii}>
          {value}
        </Chip>
      ))}
    </div>
  )
}
