export type { AllocationMeterProps } from './AllocationMeter'

/**
 * Horizontal allocation meter — a fixed-capacity track with a solid fill
 * (committed) and an optional striped segment (a staged, uncommitted change).
 * Single hue: direction isn't encoded in color, so a decrease never reads as an
 * error. Presentational and unitless — map your domain onto `max`/`value`/`pending`.
 *
 * @when Showing usage of a fixed capacity with a staged change (pool ↔ delegated,
 *   storage + pending upload, budget + pending). Width comes from `className`.
 * @avoid Task-completion / work-in-flight bars — use `Progress` instead.
 */
export { AllocationMeter } from './AllocationMeter'
