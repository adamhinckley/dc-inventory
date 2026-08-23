import { Component, type ErrorInfo, type ReactNode } from 'react'
import { ErrorState } from '#ds/ui/ErrorState'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: (props: { error: Error; reset: () => void }) => ReactNode
  /**
   * Ran when the boundary resets (default `ErrorState` retry or a `fallback`'s
   * `reset`), before the error is cleared. Pair with TanStack's
   * `QueryErrorResetBoundary` to also reset failed queries so retry refetches.
   */
  onReset?: () => void
  /**
   * When any value in this array changes (shallow, positional compare), the boundary auto-resets —
   * so a widget that errored on a bad input recovers once the input changes, without the user
   * clicking retry. Pass a stable signature of the inputs that should clear the error (e.g. the
   * active-filter signature for a dashboard cell). Order and length must be stable across renders.
   */
  resetKeys?: readonly unknown[]
  /** Optional. Format: `{feature}-{view}-{element}`. See `.claude/rules/concepts/testid.md`. */
  'data-testid'?: string
}

interface ErrorBoundaryState {
  error: Error | null
}

/** Positional shallow compare of two `resetKeys` arrays (either may be undefined). */
function keysChanged(prev: readonly unknown[] | undefined, next: readonly unknown[] | undefined) {
  if (prev === next) return false
  if (!prev || !next || prev.length !== next.length) return true
  return prev.some((value, i) => !Object.is(value, next[i]))
}

/**
 * Class-based error boundary. Catches render-time errors in descendants,
 * shows the default `ErrorState` (or a caller `fallback`), and exposes a
 * `reset` to recover.
 *
 * @when Wrapping a feature subtree where a render crash should be contained
 *   instead of taking down the page — e.g., a third-party widget, a
 *   dynamically loaded panel, the route shell.
 * @avoid Wrapping every component "just in case" — the boundary swallows the
 *   error, masking bugs. Catching async errors (effects, promises) — error
 *   boundaries only catch render-phase errors; handle async failures with
 *   try/catch and component state.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  override componentDidUpdate(prevProps: ErrorBoundaryProps) {
    // Auto-recover when the caller's reset signature changes (e.g. the dashboard filter changed),
    // so a fixed input clears a stale error without a manual retry click.
    if (this.state.error && keysChanged(prevProps.resetKeys, this.props.resetKeys)) {
      this.reset()
    }
  }

  reset = () => {
    this.props.onReset?.()
    this.setState({ error: null })
  }

  override render() {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback({
          error: this.state.error,
          reset: this.reset,
        })
      }
      return (
        <ErrorState
          message={this.state.error.message}
          onRetry={this.reset}
          data-testid={this.props['data-testid']}
        />
      )
    }
    return this.props.children
  }
}
