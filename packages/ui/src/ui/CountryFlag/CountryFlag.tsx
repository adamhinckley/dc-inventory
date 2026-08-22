import { useState, type ComponentPropsWithRef } from 'react'
import { cn } from '#cn'

// Region display names for the accessible label (`'US'` → "United States").
// Module-level so the Intl object is built once, not per render. `type:
// 'region'` is the ISO 3166-1 mode. Guarded because an unknown code throws.
const REGION_NAMES = new Intl.DisplayNames(['en'], { type: 'region' })

function regionName(code: string): string | undefined {
  try {
    return REGION_NAMES.of(code.toUpperCase())
  } catch {
    return undefined
  }
}

export interface CountryFlagProps extends Omit<
  ComponentPropsWithRef<'img'>,
  'src' | 'alt' | 'width' | 'height'
> {
  /** ISO 3166-1 alpha-2 country code (case-insensitive, e.g. `US` / `us`). */
  code: string
  /**
   * Rendered width in px; height follows the flags' 3:2 ratio. Default `20`.
   * Bump for larger contexts (an address display) — the SVG stays crisp.
   */
  size?: number
  /**
   * Accessible name override. Defaults to the `Intl.DisplayNames` region name
   * for `code` (falling back to the bare code). Ignored when `decorative`.
   */
  label?: string
  /**
   * Render the flag as decorative (`alt=""`) — use when adjacent text already
   * names the country (the phone trigger shows `+1` beside the flag, the
   * option row shows the country name). Default `false`: the flag carries its
   * own accessible name, for standalone use (a flag-only address cell).
   */
  decorative?: boolean
}

/**
 * A single country flag as a same-origin `<img>` pointing at a vendored
 * `public/flags/{code}.svg` (see `scripts/vendor-flags.ts`). Real vector art,
 * self-hosted — never an emoji glyph (blank on Windows) and never a CDN fetch
 * (blank when blocked/slow). An unknown/empty code, or a missing file, renders
 * the neutral `unknown.svg` placeholder rather than a broken-image box.
 *
 * `size` scales it for any consumer; `decorative` / `label` control the
 * accessible name so it works both beside a text label and standalone.
 */
export function CountryFlag({
  code,
  size = 20,
  label,
  decorative = false,
  className,
  ref,
  ...rest
}: CountryFlagProps) {
  // Track the specific src that failed, not a boolean — a boolean would stick
  // the placeholder forever after one transient 404, even as `code` changes to
  // a flag that loads fine. Comparing against the current src auto-resets when
  // `code` moves on, keeping the reset self-contained (no consumer keying).
  const [erroredSrc, setErroredSrc] = useState<string | null>(null)
  const normalized = code?.trim().toLowerCase() ?? ''
  const flagSrc = normalized === '' ? '/flags/unknown.svg' : `/flags/${normalized}.svg`
  const src = erroredSrc === flagSrc ? '/flags/unknown.svg' : flagSrc
  const name = decorative ? '' : (label ?? regionName(code) ?? code)

  return (
    // A raw same-origin `<img>` is the point: `next/image` would route this
    // tiny self-hosted SVG through the optimizer (an extra hop; SVGs pass
    // through unoptimized anyway) and defeat the instant-first-paint,
    // no-CDN guarantee this component exists to provide.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={src}
      alt={name}
      style={{ width: size }}
      // Inset hairline so white-field flags (Japan) and the placeholder don't
      // bleed into a light surface; `fg-muted` flips with the theme.
      className={cn(
        'inline-block aspect-3/2 h-auto rounded-xs object-cover ring-1 ring-inset ring-fg-muted/25',
        className,
      )}
      onError={() => {
        // Guard the swap so a missing unknown.svg (flagSrc === placeholder)
        // can't loop the handler.
        if (erroredSrc !== flagSrc) setErroredSrc(flagSrc)
      }}
      {...rest}
    />
  )
}
