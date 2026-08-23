import { useState } from 'react'
import { Button } from '#ds/ui/Button'
import { Dialog } from '#ds/ui/Dialog'
import { TextInput } from '#ds/ui/TextInput'

export interface ConfirmDialogConfig {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  /**
   * Optional typed-confirmation guard. When set, a text input renders in the
   * dialog body and the confirm button stays disabled until the user types
   * `phrase` exactly (trimmed). `label` is the input's accessible label;
   * omitting it falls back to a generated prompt. Backward-compatible —
   * omit for the standard confirm behavior.
   */
  requireTyped?: { phrase: string; label?: string }
  /**
   * Required. Format: `{feature}-{view}-{element}`.
   * Example: `accounts-explorer-bulk-delete-confirm-dialog`.
   * Applied to the dialog content. See `.claude/rules/concepts/testid.md`.
   */
  testid?: string
}

interface PendingConfirm {
  config: ConfirmDialogConfig
  resolve: (value: boolean) => void
}

/**
 * Manages a single confirm-dialog slot for imperative async confirmation
 * flows. Returns `confirm(config)` — opens the dialog and returns a
 * `Promise<boolean>` that resolves `true` on confirm and `false` on
 * cancel, Escape, backdrop, or close — and `dialog`, a single-instance
 * `ReactNode` that must be rendered exactly once in the tree where
 * descendants will call `confirm`. Calling `confirm()` while another is
 * pending resolves the prior promise with `false` and replaces it.
 *
 * `ConfirmDialogConfig`: `title` (required), `description` (optional),
 * `confirmLabel` (default `'Confirm'`), `cancelLabel` (default
 * `'Cancel'`), `destructive` (default `false` — when `true`, the
 * confirm button uses `variant="destructive"`), `requireTyped`
 * (optional `{ phrase, label? }` — gates the confirm button behind a
 * typed-phrase match; the typed value resets on every open).
 *
 * @when Action runtimes that need `await ctx.confirm(...)` inline in
 *   async handlers. Chained confirmations ("are you sure?" then
 *   "really sure?").
 * @avoid One-off declarative confirmations on a single page — compose
 *   `<Dialog>` directly with `useState` instead. Mounting the returned
 *   `dialog` more than once in the same subtree — the slot is
 *   single-instance and the second mount shadows the first.
 * @example
 * function ActionCtxProvider({ children }) {
 *   const { confirm, dialog } = useConfirmDialog()
 *   return (
 *     <ActionCtxContext value={{ confirm }}>
 *       {children}
 *       {dialog}
 *     </ActionCtxContext>
 *   )
 * }
 */
export function useConfirmDialog(): {
  confirm: (config: ConfirmDialogConfig) => Promise<boolean>
  dialog: React.ReactNode
} {
  const [pending, setPending] = useState<PendingConfirm | null>(null)
  // Typed-confirmation input. Reset to '' whenever a new confirm opens so a
  // stale value from a prior confirm can't leak into the next one.
  const [typed, setTyped] = useState('')

  function confirm(config: ConfirmDialogConfig) {
    return new Promise<boolean>((resolve) => {
      setTyped('')
      setPending({ config, resolve })
    })
  }

  function resolveWith(value: boolean) {
    pending?.resolve(value)
    setPending(null)
  }

  const requireTyped = pending?.config.requireTyped
  const typedOk = !requireTyped || typed.trim() === requireTyped.phrase

  const dialog = pending ? (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) resolveWith(false)
      }}
    >
      <Dialog.Content size="sm" data-testid={pending.config.testid}>
        <Dialog.Header>
          <Dialog.Title>{pending.config.title}</Dialog.Title>
          <Dialog.Close />
        </Dialog.Header>
        {(pending.config.description || requireTyped) && (
          <Dialog.Body>
            <div className="flex flex-col gap-region">
              {pending.config.description && (
                <Dialog.Description>{pending.config.description}</Dialog.Description>
              )}
              {requireTyped && (
                <TextInput
                  value={typed}
                  onChange={setTyped}
                  aria-label={requireTyped.label ?? `Type ${requireTyped.phrase} to confirm`}
                  placeholder={requireTyped.phrase}
                  data-testid={`${pending.config.testid}-typed-input`}
                  autoFocus
                />
              )}
            </div>
          </Dialog.Body>
        )}
        <Dialog.Footer>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => resolveWith(false)}
            data-testid={`${pending.config.testid}-cancel`}
          >
            {pending.config.cancelLabel ?? 'Cancel'}
          </Button>
          <Button
            variant={pending.config.destructive ? 'destructive' : 'primary'}
            size="sm"
            disabled={!typedOk}
            onClick={() => resolveWith(true)}
            data-testid={`${pending.config.testid}-confirm`}
          >
            {pending.config.confirmLabel ?? 'Confirm'}
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  ) : null

  return { confirm, dialog }
}
