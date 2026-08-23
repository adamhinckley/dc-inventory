/**
 * Class-based render-time error boundary. Catches errors in descendants,
 * renders the default `ErrorState` (or a caller `fallback`), and
 * exposes a `reset` callback to recover.
 *
 * @when Wrapping a feature subtree where a render crash should be
 *   contained instead of taking down the page — third-party widgets,
 *   dynamically loaded panels, route shells.
 * @avoid Wrapping every component "just in case" — the boundary swallows
 *   errors and masks bugs. Async failures (effects, promises, mutations)
 *   — boundaries only catch render-phase errors; handle async with
 *   try/catch and component state. Next route errors — use `RouteError`
 *   inside `error.tsx` instead.
 */
export { ErrorBoundary } from './ErrorBoundary'
