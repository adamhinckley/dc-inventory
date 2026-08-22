import { useState } from 'react'
import { Button } from '#ds/ui/Button'
import { Dialog } from '#ds/ui/Dialog'
import { TextInput } from '#ds/ui/TextInput'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DeleteActionProps {
  /** Display name of the entity being deleted — user must type this to confirm */
  name: string
  /** Entity type label shown in the dialog (e.g. "Account", "Organization") */
  label: string
  /** Async delete handler — called when user confirms */
  onDelete: () => Promise<void>
  /** Called after successful deletion */
  onSuccess?: () => void
  /** Button size. Default: 'sm' */
  size?: 'sm' | 'md' | 'lg'
  /**
   * Required. Format: `{feature}-{view}-{element}`.
   * Example: `accounts-detail-delete-action`.
   * See `.claude/rules/concepts/testid.md` for the full spec.
   */
  'data-testid'?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Type-to-confirm delete button. Renders a destructive `Delete` button that
 * opens a small dialog requiring the user to type the entity's `name` exactly
 * before the destructive action enables.
 *
 * @when High-blast-radius deletes (account, organization, license) where a
 *   single click is too easy. Pair with the entity's display name as `name`.
 * @avoid Low-stakes deletes (a single tag, a draft) — use `useConfirmDialog`
 *   for a simpler "Are you sure?" flow. Bulk deletes — render a custom dialog
 *   with selection counts.
 */
export function DeleteAction({
  name,
  label,
  onDelete,
  onSuccess,
  size = 'sm',
  'data-testid': testid,
}: DeleteActionProps) {
  const [open, setOpen] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [isPending, setIsPending] = useState(false)

  const isConfirmed = confirmation === name

  async function handleDelete() {
    setIsPending(true)
    try {
      await onDelete()
      setOpen(false)
      setConfirmation('')
      onSuccess?.()
    } finally {
      setIsPending(false)
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) setConfirmation('')
  }

  return (
    <>
      <Button variant="destructive" size={size} onClick={() => setOpen(true)} data-testid={testid}>
        Delete
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <Dialog.Content size="sm" data-testid={`${testid}-dialog`}>
          <Dialog.Header>
            <Dialog.Title>Delete {label}</Dialog.Title>
            <Dialog.Close />
          </Dialog.Header>
          <Dialog.Body>
            <p className="text-body text-fg-tertiary">
              This action cannot be undone. Type{' '}
              <span className="font-semibold text-fg">{name}</span> to confirm.
            </p>
            <TextInput
              value={confirmation}
              onChange={setConfirmation}
              placeholder={`Type the ${label.toLowerCase()} name`}
              className="mt-3"
              data-testid={`${testid}-confirm-input`}
            />
          </Dialog.Body>
          <Dialog.Footer>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleOpenChange(false)}
              data-testid={`${testid}-cancel`}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={!isConfirmed || isPending}
              onClick={handleDelete}
              data-testid={`${testid}-confirm`}
            >
              {isPending ? 'Deleting...' : `Delete ${label}`}
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog>
    </>
  )
}
