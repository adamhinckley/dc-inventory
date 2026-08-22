/**
 * 360 Privacy logo. Inline SVG with `currentColor` fill, so it inherits
 * text color from its parent.
 *
 * @when App shell header (`full`), narrow chrome and favicons (`mark`).
 * @avoid Wrapping in extra spans for color — set `text-*` on a parent or
 *   directly on the SVG; the logo inherits via `fill-current`.
 * @variants variant (`full`/`mark`)
 */
export { Logo } from './Logo'
export type { LogoProps } from './Logo'
export { LogoAnimated } from './LogoAnimated'
export type { LogoAnimatedProps } from './LogoAnimated'
