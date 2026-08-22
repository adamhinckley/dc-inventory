import { ChipRoot, ChipDot } from './Chip'

export type { ChipProps } from './Chip'

/**
 * Compact pill for tagging or status. Optional leading icon (or `Chip.Dot`)
 * and optional dismiss button. Uses `--chip-color` so callers tint via a
 * single CSS variable.
 *
 * @when Tagging metadata, status badges, filter chips, count indicators —
 *   any short label that benefits from visual containment.
 * @avoid Interactive selectable pills in a list (use a button or
 *   `interactable` archetype). Long-form labels (use `text-fg-secondary`
 *   inline).
 * @variants animation (`none`/`slow`/`fast`)
 */
export const Chip = Object.assign(ChipRoot, { Dot: ChipDot })
