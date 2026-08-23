import { useState, type ComponentPropsWithRef, type ReactNode } from 'react'
import { Check, Copy } from 'lucide-react'
import { PII_MASK_CLASS } from '#shared/constants/pii-mask'
import { cn } from '#cn'

function useCopy() {
  const [copied, setCopied] = useState(false)

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard permissions can fail — fail silently. No UI surface for this error.
    }
  }

  return { copied, copy }
}

// ---------------------------------------------------------------------------
// CopyableText — short inline label + always-visible copy button
// ---------------------------------------------------------------------------

interface CopyableTextProps extends Omit<ComponentPropsWithRef<'span'>, 'children'> {
  /** Raw value written to the clipboard. */
  value: string
  /** Rendered label — defaults to `value`. */
  children?: ReactNode
  /**
   * When true, marks the rendered label for marker.io PII masking. The
   * copy button is never masked.
   */
  pii?: boolean
  /**
   * When true, the value wraps (breaking long unbroken tokens like URLs) and
   * fills the available width instead of truncating to a single line. The copy
   * button aligns to the first line. Use for a single value that may exceed its
   * container — not multi-line prose (use `CopyableLongText`).
   */
  wrap?: boolean
  /**
   * Required. Format: `{feature}-{view}-{element}`.
   * Example: `accounts-detail-id-copyable`.
   * See `.claude/rules/concepts/testid.md` for the full spec.
   */
  'data-testid'?: string
}

/**
 * Inline label paired with a copy-to-clipboard button. Renders the `value`
 * (or `children`) as a `<span>` followed by a small copy button that writes
 * `value` to the clipboard on click.
 *
 * @when Short identifiers users routinely copy — IDs, hashes, slugs, emails
 *   in detail panels.
 * @avoid Inside table cells — the always-visible copy button adds noise
 *   to dense rows; expose copy via a row action or detail view instead.
 *   Long-form text or anything that needs line clamping — use
 *   `CopyableLongText`.
 */
export function CopyableText({
  value,
  children,
  className,
  pii,
  wrap,
  ref,
  ...rest
}: CopyableTextProps) {
  const { copied, copy } = useCopy()

  return (
    <span
      ref={ref}
      className={cn(
        'inline-flex gap-tight max-w-full',
        wrap ? 'items-start' : 'items-center',
        className,
      )}
      {...rest}
    >
      <span className={cn(wrap ? 'min-w-0 break-all' : 'truncate', pii && PII_MASK_CLASS)}>
        {children ?? value}
      </span>
      <button
        type="button"
        onClick={() => copy(value)}
        aria-label={copied ? 'Copied' : `Copy ${value}`}
        // Safari skips plain `<button>` elements in sequential tab navigation
        // by default. Explicit `tabIndex={0}` matches Chrome/Firefox so the
        // copy affordance is reachable without changing system settings.
        tabIndex={0}
        className="interactable ghost inline-flex size-5 shrink-0 items-center justify-center"
      >
        {copied ? (
          <Check className="size-icon-sm text-success" aria-hidden />
        ) : (
          <Copy className="size-icon-sm" aria-hidden />
        )}
      </button>
    </span>
  )
}

// ---------------------------------------------------------------------------
// CopyableLongText — multi-line block + hover-revealed copy button
// ---------------------------------------------------------------------------

interface CopyableLongTextProps extends Omit<ComponentPropsWithRef<'div'>, 'children'> {
  value: string
  /** Max lines to show before truncating. Default: 3. */
  lineClamp?: number
  /**
   * When true, marks the rendered text block for marker.io PII masking.
   * The copy button is never masked.
   */
  pii?: boolean
  /**
   * Required. Format: `{feature}-{view}-{element}`.
   * Example: `incidents-detail-description-copyable`.
   * See `.claude/rules/concepts/testid.md` for the full spec.
   */
  'data-testid'?: string
}

/**
 * Multi-line text block with a hover-revealed copy button. Clamps to
 * `lineClamp` lines (default 3) and exposes the copy button on hover/focus.
 *
 * @when Longer text users may want to copy verbatim — descriptions, notes,
 *   raw payloads in detail views.
 * @avoid Single-line identifiers — use `CopyableText`. Editable content —
 *   use a textarea inside a `Form.Field`.
 */
export function CopyableLongText({
  value,
  lineClamp = 3,
  className,
  pii,
  ref,
  ...rest
}: CopyableLongTextProps) {
  const { copied, copy } = useCopy()

  return (
    <div ref={ref} className={cn('group flex items-start gap-icon', className)} {...rest}>
      <p
        className={cn('flex-1 text-body-sm text-fg-secondary', pii && PII_MASK_CLASS)}
        style={{
          display: '-webkit-box',
          WebkitBoxOrient: 'vertical',
          WebkitLineClamp: lineClamp,
          overflow: 'hidden',
        }}
      >
        {value}
      </p>
      <button
        type="button"
        onClick={() => copy(value)}
        aria-label={copied ? 'Copied' : 'Copy text'}
        // Safari skips plain `<button>` elements in sequential tab navigation
        // by default. Explicit `tabIndex={0}` matches Chrome/Firefox so the
        // copy affordance is reachable without changing system settings.
        tabIndex={0}
        className="interactable ghost mt-0.5 inline-flex size-6 shrink-0 items-center justify-center opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
      >
        {copied ? (
          <Check className="size-icon text-success" aria-hidden />
        ) : (
          <Copy className="size-icon" aria-hidden />
        )}
      </button>
    </div>
  )
}
