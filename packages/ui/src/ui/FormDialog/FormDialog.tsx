'use client'

import { useState, type ReactElement, type ReactNode } from 'react'
import { useWatch, type DefaultValues, type FieldValues, type UseFormReturn } from 'react-hook-form'
import { type QueryKey } from '@tanstack/react-query'
import type { z, ZodTypeAny } from 'zod'
import { Button } from '#ds/ui/Button'
import { useConfirmDialog, type ConfirmDialogConfig } from '#ds/ui/ConfirmDialog'
import { Dialog } from '#ds/ui/Dialog'
import { Form, useFormSubmit } from '#ds/ui/Form'

type SubmitVariant = 'primary' | 'destructive'

/**
 * A value, or a function deriving it from the live form values. Function forms
 * receive `useWatch()` output — the raw, pre-validation input values (typed as
 * the schema output for ergonomics, since the two coincide for the plain
 * object schemas dialogs use). A schema with `transform`/`coerce`/`default`
 * would hand these functions untransformed values, and mid-edit they can be
 * partial — derive from stable discriminators (a select value), not parsed
 * results.
 */
type Reactive<T, V> = T | ((values: V) => T)

export interface FormDialogProps<TSchema extends ZodTypeAny, TResult = unknown> {
  /**
   * Element that opens the dialog. Typically a `<Button>` with icon + label.
   * Forwarded to `Dialog.Trigger` via the `render` prop, so any element that
   * renders its own `<button>` is fine — Base UI composes the open behavior
   * onto it without nesting.
   *
   * Optional when `open` + `onOpenChange` are supplied — controlled mode owns
   * the open state externally (e.g. opening from inside a `<Menu.Item>` where
   * the menu dismisses the item click before `Dialog.Trigger`'s open handler
   * can fire, so the dialog has to be mounted as a sibling of the menu).
   */
  trigger?: ReactElement<Record<string, unknown>>
  /**
   * Controlled open state. When provided, the dialog skips the internal
   * `useState` and reflects the caller's value. Pair with `onOpenChange`.
   */
  open?: boolean
  /**
   * Controlled-mode open setter. Required when `open` is provided. Called
   * both when the user dismisses the dialog (`false`) and after a successful
   * submit (also `false` — the dialog closes itself on success).
   */
  onOpenChange?: (open: boolean) => void
  /** Dialog title. */
  title: ReactNode
  /** Optional dialog description shown beneath the title. */
  description?: ReactNode
  /** Zod schema for the form. */
  schema: TSchema
  /** Initial form values. */
  defaultValues: DefaultValues<z.input<TSchema>>
  /**
   * Run the mutation. Receives the validated form data; the consumer
   * closes over any extra arguments (resource id, parent ids).
   */
  mutate: (data: z.output<TSchema>) => Promise<TResult>
  /**
   * Toast title shown on successful mutation. Pass a function to derive it from
   * the result / submitted data when the copy depends on what was submitted
   * (e.g. "Records Archived" vs "Records Deleted" by the chosen disposition).
   */
  successMessage: string | ((result: TResult, data: z.output<TSchema>) => string)
  /**
   * Query keys to invalidate after success. Pass a single key, a list of keys,
   * or a function that returns either — use the function form when which keys
   * to invalidate depends on what the user submitted or the server returned.
   */
  invalidate?:
    | QueryKey
    | QueryKey[]
    | ((result: TResult, data: z.output<TSchema>) => QueryKey | QueryKey[])
  /**
   * Runs after invalidation when the mutation succeeds. The dialog closes
   * automatically on success — use this for additional behavior like
   * navigating to the newly created resource.
   */
  onSuccess?: (result: TResult) => void
  /**
   * Custom failure handler, run before the default server-error mapping. Return
   * `true` to signal the error is fully handled (the dialog skips
   * `mapServerErrors`); return `false`/nothing to fall through to the default.
   * Use for a domain error whose own message must reach the root banner
   * verbatim — a non-`Response` throw the default mapping would otherwise
   * replace with generic network copy.
   */
  onError?: (
    err: unknown,
    form: UseFormReturn<z.input<TSchema> & FieldValues>,
  ) => boolean | void | Promise<boolean | void>
  /**
   * Submit button label. Capitalize every word (e.g. "Create User"). Pass a
   * function to react to the live form values — e.g. a disposition select that
   * flips the label between "Archive Records" and "Delete Records".
   */
  submitLabel: Reactive<ReactNode, z.output<TSchema>>
  /** Submit button label while in flight. Accepts the same function form as `submitLabel`. */
  pendingLabel?: Reactive<ReactNode, z.output<TSchema>>
  /**
   * Submit button variant — `destructive` for forms whose submit deletes.
   * Defaults to `primary`. Accepts a function of the live values so the button
   * can turn destructive only on the delete path.
   */
  submitVariant?: Reactive<SubmitVariant, z.output<TSchema>>
  /**
   * Pre-mutate confirmation. When set, a valid submit opens a confirm dialog
   * built from this config (derived from the submitted values — e.g. "Remove
   * 5 licenses?") before the mutation fires. Cancel leaves the form dialog
   * open and untouched — no request, no error, no toast. Return `null` to skip
   * the confirm for this submit — e.g. only the destructive branch of a
   * multi-disposition form needs an "are you sure?".
   *
   * Cosmetic caveat: the form counts as submitting while the confirm dialog
   * is open, so the submit button shows `pendingLabel` before any request
   * fires (it resets on cancel).
   */
  confirm?: (data: z.output<TSchema>) => ConfirmDialogConfig | null
  /**
   * Form-aware guard run after schema validation but BEFORE the confirm dialog
   * and the mutation. Return `false` to block the submit (no confirm, no
   * request); return `true`/`undefined` to proceed. Async is awaited.
   *
   * This is the seam for validation the schema can't express — specifically a
   * cross-field rule that must surface as a ROOT banner ("enter at least one
   * of these"). RHF ignores resolver-set `root` errors, so such a rule can't
   * live in the Zod schema; set it imperatively here with
   * `form.setError('root', …)` and return `false`. Field-level rules still
   * belong in the schema — reach for this only when you need the form handle.
   */
  beforeSubmit?: (
    data: z.output<TSchema>,
    form: UseFormReturn<z.input<TSchema> & FieldValues>,
  ) => boolean | void | Promise<boolean | void>
  /** Form fields rendered inside `<Form.Fieldset>`. */
  children: ReactNode
  /** Dialog content size. Defaults to `md`. */
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /**
   * Required. Format: `{feature}-{view}-{element}`.
   * Applied to the dialog content root. The trigger element supplies its own
   * `data-testid`; this id targets the dialog itself plus a `{testid}-trigger`
   * derived id on `Dialog.Trigger` and `{testid}` on the form root.
   * Example: `accounts-create-form-dialog`.
   * See `.claude/rules/concepts/testid.md` for the full spec.
   */
  'data-testid'?: string
}

/**
 * Resource-form dialog. Trigger + dialog chrome + form + submit/cancel +
 * mutation wiring + server-error mapping in one component, so create/edit
 * dialogs collapse to ~30 lines of schema + fields. Handles open state,
 * query invalidation, close-on-success, and 422 → field error mapping.
 * Destructive flows pass `submitVariant="destructive"` and optionally
 * `confirm` for a pre-mutate "are you sure?" dialog.
 *
 * @when Standard create/edit flows for a single resource — "New user", "Edit
 *   account", "Add source". The fast path for the common case.
 * @avoid Bespoke chrome — multi-section forms, custom footers, non-standard
 *   trigger flows. Drop down a layer and compose `<Dialog>` + `<Form>`
 *   directly. FormDialog is the fast path, not the only path.
 * @example
 * <FormDialog
 *   trigger={<Button variant="primary"><Plus /> New user</Button>}
 *   title="New user"
 *   schema={createUserSchema}
 *   defaultValues={{...}}
 *   mutate={(data) => mutateAsync({ data })}
 *   successMessage="User created"
 *   invalidate={getListUsersQueryKey()}
 *   submitLabel="Create user"
 *   pendingLabel="Creating…"
 * >
 *   <Form.Field field={userFields.email} />
 *   <Form.Field field={userFields.name} />
 * </FormDialog>
 */
export function FormDialog<TSchema extends ZodTypeAny, TResult = unknown>({
  trigger,
  open: controlledOpen,
  onOpenChange,
  title,
  description,
  schema,
  defaultValues,
  mutate,
  successMessage,
  invalidate,
  onSuccess,
  onError,
  submitLabel,
  pendingLabel,
  submitVariant,
  confirm,
  beforeSubmit,
  children,
  size,
  'data-testid': testid,
}: FormDialogProps<TSchema, TResult>) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = (next: boolean) => {
    if (!isControlled) setInternalOpen(next)
    onOpenChange?.(next)
  }
  type Input = z.input<TSchema> & FieldValues

  const { confirm: confirmFn, dialog: confirmDialog } = useConfirmDialog()

  const baseOnSubmit = useFormSubmit<Input, TResult>({
    mutate: (data) => mutate(data as z.output<TSchema>),
    successMessage:
      typeof successMessage === 'function'
        ? (result, data) => successMessage(result, data as unknown as z.output<TSchema>)
        : successMessage,
    invalidate:
      typeof invalidate === 'function'
        ? (result, data) => invalidate(result, data as unknown as z.output<TSchema>)
        : invalidate,
    onSuccess: (result) => {
      setOpen(false)
      onSuccess?.(result)
    },
    onError,
  })

  // Wraps the submit handler, not the mutate: the guard/confirm run before any
  // mutation state exists, so blocking or cancelling just leaves the form
  // dialog open, untouched. Order is validation (RHF) → beforeSubmit → confirm
  // → mutate.
  const onSubmit = async (data: Input, form: Parameters<typeof baseOnSubmit>[1]) => {
    if (beforeSubmit && (await beforeSubmit(data as z.output<TSchema>, form)) === false) return
    if (confirm) {
      const config = confirm(data as z.output<TSchema>)
      if (config && !(await confirmFn(config))) return
    }
    await baseOnSubmit(data, form)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? <Dialog.Trigger render={trigger} data-testid={`${testid}-trigger`} /> : null}
      <Dialog.Content size={size} data-testid={testid}>
        <Dialog.Header>
          <Dialog.Title>{title}</Dialog.Title>
          <Dialog.Close />
        </Dialog.Header>
        <Form
          schema={schema}
          defaultValues={defaultValues}
          onSubmit={onSubmit as (data: z.output<TSchema>, form: UseFormReturn<Input>) => void}
          data-testid={`${testid}-form`}
        >
          <Dialog.Body className="flex flex-col gap-region">
            {description ? <Dialog.Description>{description}</Dialog.Description> : null}
            <Form.Fieldset>{children}</Form.Fieldset>
            <Form.RootError />
          </Dialog.Body>
          <Dialog.Footer>
            <Form.Actions>
              <Dialog.Close
                render={<Button variant="ghost" type="button" data-testid={`${testid}-cancel`} />}
              >
                Cancel
              </Dialog.Close>
              <DialogSubmit<z.output<TSchema>>
                testid={testid}
                label={submitLabel}
                pendingLabel={pendingLabel}
                variant={submitVariant}
              />
            </Form.Actions>
          </Dialog.Footer>
        </Form>
        {confirmDialog}
      </Dialog.Content>
    </Dialog>
  )
}

/**
 * The dialog's submit button, rendered inside `<Form>` so it can `useWatch` the
 * live values and resolve any function-valued `label` / `pendingLabel` /
 * `variant`. Static props pass straight through — the reactive path only
 * engages when a function is supplied.
 */
function DialogSubmit<V>({
  testid,
  label,
  pendingLabel,
  variant,
}: {
  testid?: string
  label: Reactive<ReactNode, V>
  pendingLabel?: Reactive<ReactNode, V>
  variant?: Reactive<SubmitVariant, V>
}) {
  const values = useWatch() as V
  function resolve<T>(value: Reactive<T, V> | undefined): T | undefined {
    return typeof value === 'function' ? (value as (values: V) => T)(values) : value
  }
  return (
    <Form.Submit
      pendingLabel={resolve(pendingLabel)}
      variant={resolve(variant)}
      data-testid={`${testid}-submit`}
    >
      {resolve(label)}
    </Form.Submit>
  )
}
