/**
 * Animated loading spinner. Indeterminate progress indicator that announces
 * itself via `role="status"`.
 *
 * @when In-flight feedback for a localized async action — submit pending
 *   state, panel-level loading, polling indicators.
 * @avoid Page-level loading where layout should settle before data arrives —
 *   use `Skeleton` placeholders so the page doesn't shift.
 * @variants size (`sm`/`md`/`lg`)
 */
export { Spinner } from './Spinner'
export type { SpinnerProps } from './Spinner'
