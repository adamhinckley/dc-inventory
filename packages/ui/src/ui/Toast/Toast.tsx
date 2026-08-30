'use client'

import { useEffect } from 'react'
import { Toast as BaseToast } from '@base-ui-components/react/toast'
import { cva } from 'class-variance-authority'
import { CircleCheck, CircleX, Info, TriangleAlert, X } from 'lucide-react'
import { cn } from '#cn'
import { silenceReactFlushSyncLifecycleWarning } from './toast-flush-sync-warning'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Intent = 'success' | 'error' | 'warning' | 'info'

export interface ToastOptions {
  intent: Intent
  title: React.ReactNode
  description?: React.ReactNode
  action?: { label: string; onClick: () => void }
  /** Override auto-close timeout in ms. 0 = never auto-close. */
  timeout?: number
  /**
   * Required. Format: `{feature}-{view}-{element}`.
   * Example: `accounts-create-success-toast`.
   * Applied to the toast root. See `.claude/rules/concepts/testid.md`.
   */
  testid?: string
}

interface ToastData {
  actionLabel?: string
  actionOnClick?: () => void
  testid?: string
}

// ---------------------------------------------------------------------------
// Variants
// ---------------------------------------------------------------------------

const toastVariants = cva(
  'flex w-80 items-start gap-icon rounded-interactable p-card shadow-modal transition-all duration-200 data-ending-style:translate-x-full data-ending-style:opacity-0 data-starting-style:translate-x-full data-starting-style:opacity-0',
  {
    variants: {
      intent: {
        success: 'bg-success text-success-content',
        error: 'bg-error text-error-content',
        warning: 'bg-warning text-warning-content',
        info: 'bg-info text-info-content',
      },
    },
    defaultVariants: { intent: 'info' },
  },
)

// ---------------------------------------------------------------------------
// Intent config
// ---------------------------------------------------------------------------

const intentConfig: Record<Intent, { icon: typeof Info; timeout: number }> = {
  success: { icon: CircleCheck, timeout: 5000 },
  error: { icon: CircleX, timeout: 0 },
  warning: { icon: TriangleAlert, timeout: 8000 },
  info: { icon: Info, timeout: 5000 },
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

export interface ToastProviderProps {
  children: React.ReactNode
}

/**
 * Toast manager root. Provides the toast queue context to descendants so
 * `useToast()` can enqueue and `Toast.Viewport` can render.
 *
 * @when Mount once at the app root, above any caller of `useToast` and any
 *   `Toast.Viewport`.
 */
export function ToastProvider({ children }: ToastProviderProps) {
  useEffect(() => silenceReactFlushSyncLifecycleWarning(), [])
  return <BaseToast.Provider>{children}</BaseToast.Provider>
}

/**
 * Renders the visible toast stack at the bottom-right of the viewport.
 * Reads queued toasts from the provider and renders each via the internal
 * `ToastCard`.
 *
 * @when Mount once inside `<Toast>` (typically in the app shell). The
 *   provider must wrap it.
 * @tokens z-toast (stack z-index)
 */
export function ToastViewport() {
  const { toasts } = BaseToast.useToastManager()

  return (
    <BaseToast.Viewport className="fixed bottom-0 right-0 z-toast flex flex-col-reverse gap-icon p-card outline-hidden">
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} />
      ))}
    </BaseToast.Viewport>
  )
}

function ToastCard({ toast }: { toast: BaseToast.Root.ToastObject<ToastData> }) {
  const intent = (toast.type as Intent | undefined) ?? 'info'
  const { icon: Icon } = intentConfig[intent]
  const data = toast.data

  return (
    <BaseToast.Root
      toast={toast}
      className={cn(toastVariants({ intent }))}
      data-testid={data?.testid}
    >
      <Icon className="mt-0.5 size-icon-lg shrink-0" aria-hidden />
      <div className="flex flex-1 flex-col gap-tight">
        <BaseToast.Title className="text-body-emphasis">{toast.title}</BaseToast.Title>
        {toast.description && (
          <BaseToast.Description className="text-body-sm opacity-80">
            {toast.description}
          </BaseToast.Description>
        )}
        {data?.actionLabel && (
          <BaseToast.Action
            className="self-start rounded-interactable px-2 py-0.5 text-body-sm font-medium opacity-90 transition-opacity hover:opacity-100"
            onClick={data.actionOnClick}
          >
            {data.actionLabel}
          </BaseToast.Action>
        )}
      </div>
      <BaseToast.Close
        className="rounded-interactable -mr-1 -mt-1 inline-flex size-6 shrink-0 items-center justify-center opacity-70 transition-opacity hover:opacity-100"
        aria-label="Close"
      >
        <X className="pointer-events-none size-icon" />
      </BaseToast.Close>
    </BaseToast.Root>
  )
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Imperative toast API. Returns `toast(options)` to enqueue and `close(id)`
 * to dismiss. Default timeouts are intent-aware (errors stay open, info/
 * warning auto-close); pass `timeout` to override or `0` to require manual
 * dismissal. Toasts with an action default to `0` so the user can act on them.
 *
 * @when Calling from event handlers, mutation `onSuccess`/`onError`, async
 *   side effects.
 * @avoid Calling during render — toasts are imperative; trigger them from
 *   effects, handlers, or callbacks.
 * @example
 * const { toast } = useToast()
 * toast({ intent: 'success', title: 'Saved' })
 * toast({ intent: 'error', title: 'Failed to save', description: err.message })
 */
export function useToast() {
  const manager = BaseToast.useToastManager()

  function toast(options: ToastOptions) {
    const { intent, title, description, action, timeout: timeoutOverride, testid } = options
    const config = intentConfig[intent]
    const timeout = timeoutOverride ?? (action ? 0 : config.timeout)

    return manager.add<ToastData>({
      type: intent,
      title,
      description,
      timeout,
      priority: intent === 'error' ? 'high' : 'low',
      data: {
        testid,
        ...(action ? { actionLabel: action.label, actionOnClick: action.onClick } : {}),
      },
    })
  }

  function close(toastId: string) {
    manager.close(toastId)
  }

  return { toast, close }
}
