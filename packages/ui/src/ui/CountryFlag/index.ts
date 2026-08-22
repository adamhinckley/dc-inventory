'use client'

/**
 * A single country flag rendered as a same-origin `<img>` from a vendored
 * `public/flags/{code}.svg`. Self-hosted vector art — never emoji, never a
 * CDN — with a neutral placeholder for unknown/empty codes.
 *
 * @when Showing a country's flag beside a code or name — the `PhoneInput`
 *   country selector, a future address country field, any flag-bearing cell.
 * @avoid A picker of countries — compose this inside `Combobox` options, don't
 *   rebuild the list here. Emoji flags or a CDN sprite — that's the bug this
 *   replaces (see `scripts/vendor-flags.ts`).
 */
export { CountryFlag, type CountryFlagProps } from './CountryFlag'
