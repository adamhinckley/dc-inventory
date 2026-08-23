import { ToastProvider, ToastViewport, useToast } from './Toast'

export type { ToastOptions, ToastProviderProps } from './Toast'

/**
 * Transient notification system. `<Toast>` is the provider; `<Toast.Viewport>`
 * mounts the visible stack; `useToast()` is the imperative API for raising
 * toasts from event handlers and async flows.
 *
 * @when Side-effect feedback that doesn't block the user — save successes,
 *   non-blocking errors, "copied to clipboard", undo prompts.
 * @avoid Confirmations the user must respond to — use `useConfirmDialog`.
 *   Critical errors that need user attention to recover — render an
 *   `ErrorState` inline.
 */
export const Toast = Object.assign(ToastProvider, {
  Viewport: ToastViewport,
})

export { useToast }
