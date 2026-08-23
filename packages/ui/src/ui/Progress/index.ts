'use client'

export type { ProgressProps } from './Progress'

/**
 * Thin (2px) progress bar. Indeterminate sweep by default; pass
 * `value={n}` (0–100) for a determinate fill.
 *
 * @when Background mutation or refetch indicators (indeterminate),
 *   long-running operations reporting % complete (determinate). Common
 *   spots: dialog/drawer footer top border, atop a refetching table,
 *   page-level loading bar.
 * @avoid Persistent always-on indicators — only render while work is in
 *   flight.
 */
export { Progress } from './Progress'
