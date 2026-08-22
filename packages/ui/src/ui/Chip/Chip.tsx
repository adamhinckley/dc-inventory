import type { ComponentPropsWithRef, ReactNode, Ref } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { X } from 'lucide-react'
import { PII_MASK_CLASS } from '#shared/constants/pii-mask'
import { cn } from '#cn'
import './Chip.css'

// ---------------------------------------------------------------------------
// Variants
// ---------------------------------------------------------------------------

const chipVariants = cva(
  // `max-w-full min-w-0 whitespace-nowrap` keep the pill atomic when it's a
  // flex child of a too-narrow container (e.g. a shrunk table cell): the chip
  // caps at the cell width and its label ellipsizes on one line (see the
  // label span's `truncate`) instead of the default flex behavior — collapsing
  // to the longest word and wrapping the rounded-full pill into a misshapen
  // two-line blob. No-op where the chip has room to size to its content.
  'glassmorphic-chip relative inline-flex max-w-full min-w-0 items-center gap-icon whitespace-nowrap rounded-full px-item-x py-0.5 text-xs font-medium [--chip-color:var(--color-fg-secondary)] text-(--chip-ink)',
  {
    variants: {
      animation: {
        none: '',
        slow: 'animate-border-trace',
        fast: 'animate-border-trace',
      },
    },
    defaultVariants: { animation: 'none' },
  },
)

const ANIMATION_DURATION_MS = {
  fast: 2000,
  slow: 5000,
} satisfies Record<'fast' | 'slow', number>

/**
 * Ref callback that forwards to an external ref and, when a duration is given,
 * drives `--angle` via requestAnimationFrame for the border trace animation.
 * Returns a cleanup that cancels the frame and nulls the forwarded ref.
 */
function createAnimatedChipRef(
  forwardedRef: Ref<HTMLSpanElement> | undefined,
  duration: number | undefined,
) {
  const assignRef = (node: HTMLSpanElement | null) => {
    if (typeof forwardedRef === 'function') forwardedRef(node)
    else if (forwardedRef) forwardedRef.current = node
  }

  return (node: HTMLSpanElement | null) => {
    assignRef(node)

    if (!node || !duration) {
      return () => assignRef(null)
    }

    let start: number | null = null
    const tick = (timestamp: number) => {
      if (start === null) start = timestamp
      const angle = ((timestamp - start) / duration) * 360
      node.style.setProperty('--angle', `${angle % 360}deg`)
      frameId = requestAnimationFrame(tick)
    }
    let frameId = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frameId)
      assignRef(null)
    }
  }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ChipProps
  extends ComponentPropsWithRef<'span'>, VariantProps<typeof chipVariants> {
  icon?: ReactNode
  onDismiss?: () => void
  /**
   * When true, marks the chip label for marker.io PII masking. Use for
   * chips whose label is user data (a username, email, account name) —
   * skip for status / enum / filter chips.
   */
  pii?: boolean
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/**
 * Colored dot indicator for status chips.
 *
 * @when Pass to the `icon` prop: `<Chip icon={<Chip.Dot />}>Label</Chip>`
 * @avoid Do NOT use as a direct child — the children wrapper is not flex-laid-out,
 *   so the dot will stack vertically instead of sitting inline.
 */
export function ChipDot() {
  return (
    <span
      className="stacked block size-1.5 flex-shrink-0 rounded-full bg-(--chip-ink)"
      aria-hidden="true"
    />
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Chip body. Renders a `<span>` with optional `icon`, a label (`children`),
 * and an optional dismiss button (`onDismiss`).
 *
 * Tint via `--chip-color`: set it on a parent or via a CVA variant on the
 * caller (e.g., `[--chip-color:var(--color-status-open)]`). The label, icon,
 * and dot render in `--chip-ink` (derived from `--chip-color`): on light
 * surfaces it's an oklch-lightness-clamped, hue-preserving darkening so any
 * chip color clears WCAG AA as small text; in dark mode it's the color as-is.
 *
 * @when Any compact label — status, tag, filter chip. For a domain enum that
 *   maps to icon + color + label (e.g. `IncidentStatus`, `PrincipalStatus`),
 *   do the mapping **inline in the feature** and pass `icon`
 *   plus a `[--chip-color:...]` className to plain `Chip`. See the @example.
 * @avoid Putting interactive content in `children` other than text — the
 *   children wrapper is `stacked`, not flex; nested controls won't lay out.
 * @avoid Wrapping `Chip` in a feature-specific component
 *   (`PrincipalStatusChip`, `IncidentStatusChip`, etc.) to
 *   hide an enum→glyph/color/label table. Such a wrapper imports the domain
 *   enum, which violates the `ui/` layer rule ("no business domain
 *   knowledge"); it also has a single consumer, so it fails the
 *   "earned-by-repetition" bar from CLAUDE.md. The mapping table belongs
 *   next to the field config / cell render in the feature. `ActiveStatusChip`
 *   is the **only** acceptable status-style wrapper here because its prop
 *   is a primitive `boolean`, not a domain enum.
 * @tokens --chip-color (caller-set hue; drives border/fill), --chip-ink
 *   (derived label/icon/dot color, AA-safe in light mode), glassmorphic-chip (border/bg)
 * @example
 * // In src/features/{name}/fields.tsx — feature owns the domain mapping:
 * const STATUS_PRESENTATION: Record<MyStatus, { tint: string; icon: ReactNode; label: string }> = {
 *   open:     { tint: '[--chip-color:var(--color-status-open)]',    icon: <Circle className="size-icon-sm" />, label: 'Open' },
 *   resolved: { tint: '[--chip-color:var(--color-status-cleared)]', icon: <Check  className="size-icon-sm" />, label: 'Resolved' },
 * }
 *
 * // In the field's `render` (or a cell):
 * render: ({ value }) => {
 *   const p = STATUS_PRESENTATION[value as MyStatus]
 *   return <Chip icon={p.icon} className={p.tint} data-testid="my-feature-status-chip">{p.label}</Chip>
 * }
 */
export function ChipRoot({
  ref,
  animation,
  icon,
  onDismiss,
  className,
  children,
  pii,
  ...rest
}: ChipProps) {
  const duration =
    animation === 'fast' || animation === 'slow' ? ANIMATION_DURATION_MS[animation] : undefined

  return (
    <span
      ref={createAnimatedChipRef(ref, duration)}
      className={cn(chipVariants({ animation }), className)}
      {...rest}
    >
      {icon && (
        <span className="stacked flex-shrink-0 text-(--chip-ink)" aria-hidden="true">
          {icon}
        </span>
      )}
      <span className={cn('stacked min-w-0 truncate', pii && PII_MASK_CLASS)}>{children}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="stacked -mr-0.5 rounded-full p-0.5 opacity-60 transition-opacity hover:opacity-100"
          aria-label="Dismiss"
        >
          <X className="size-icon-sm" />
        </button>
      )}
    </span>
  )
}
