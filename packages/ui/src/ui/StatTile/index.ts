'use client'

/**
 * A single stat card — label, big value, optional glyph+color trend chip, and an
 * optional embedded `Sparkline`. Props-driven leaf for data-driven tile grids
 * (Exposure Overview PII types, ECM signal cards).
 *
 * @when Rendering N metrics as a uniform grid where each shows a headline value
 *   and, optionally, a period-over-period trend and micro trend line. Set
 *   `onSelect` to make the whole tile a drill-through button.
 * @avoid A single hero metric with rich chrome (compose `Panel` directly), or a
 *   full chart with axes (use `LineChart`/`AreaChart`).
 */
export { StatTile } from './StatTile'
export type { StatTileProps, StatTileTrend, StatTileTrendDirection } from './StatTile'
