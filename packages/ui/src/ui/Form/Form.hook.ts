'use client'

import { type QueryKey, useQueryClient } from '@tanstack/react-query'
import { type FieldValues, type UseFormReturn } from 'react-hook-form'
import { useToast } from '#ds/ui/Toast'
import { mapServerErrors } from '#shared/http/server-errors'

export interface UseFormSubmitOptions<TInput extends FieldValues, TResult = unknown> {
  /**
   * Run the mutation. Receives the validated form data; the consumer wraps
   * any extra arguments (resource id, parent ids) in the closure:
   *
   *   const { mutateAsync } = useCreateUser()
   *   useFormSubmit({ mutate: (data) => mutateAsync({ data }), ... })
   *
   *   const { mutateAsync } = usePatchAccount()
   *   useFormSubmit({ mutate: (data) => mutateAsync({ accountId, data }), ... })
   */
  mutate: (data: TInput) => Promise<TResult>
  /**
   * Toast title shown on successful mutation. Pass a function to derive it from
   * the result / submitted data when the copy depends on what was submitted
   * (e.g. "Licenses Moved" vs "Licenses Removed" by destination).
   */
  successMessage: string | ((result: TResult, data: TInput) => string)
  /**
   * TanStack Query keys to invalidate after a successful mutation. Each
   * entry is a `QueryKey` (typically from a generated `getListXyzQueryKey`
   * factory). Pass a single key or a list — both are awaited concurrently.
   *
   * Also accepts a function that returns the keys, called with the mutation
   * result and the submitted form data. Use the function form when which keys
   * to invalidate depends on what the user submitted or what the server
   * returned (e.g. only invalidate the organizations list when the new
   * account's type is not `'Partner'`).
   */
  invalidate?: QueryKey | QueryKey[] | ((result: TResult, data: TInput) => QueryKey | QueryKey[])
  /** Runs after invalidation when the mutation succeeds. Typical use: close the dialog. */
  onSuccess?: (result: TResult) => void
  /**
   * Custom failure handler, run before the default `mapServerErrors`. Return
   * `true` to signal the error is fully handled (skip `mapServerErrors`);
   * return `false`/nothing to fall through to the default mapping. Use for a
   * domain error whose own message must reach the root banner verbatim — a
   * non-`Response` throw that `mapServerErrors` would otherwise replace with
   * generic network copy.
   */
  onError?: (err: unknown, form: UseFormReturn<TInput>) => boolean | void | Promise<boolean | void>
}

/**
 * Wire a Form to a mutation. Returns an `onSubmit(data, form)` ready to
 * pass directly to `<Form onSubmit={...} />`:
 *
 *   const onSubmit = useFormSubmit<CreateUserInput>({
 *     mutate: (data) => mutateAsync({ data }),
 *     successMessage: 'User created',
 *     invalidate: getListUsersQueryKey(),
 *     onSuccess: () => setOpen(false),
 *   })
 *
 *   <Form schema={createUserSchema} defaultValues={...} onSubmit={onSubmit}>
 *
 * On success: shows the toast, invalidates the listed queries, calls
 * `onSuccess`. On failure: gives `onError` first refusal (return `true` to
 * fully handle it), then routes through `mapServerErrors` so 422 validation
 * errors land on their fields and other errors land on `Form.RootError`.
 */
export function useFormSubmit<TInput extends FieldValues, TResult = unknown>({
  mutate,
  successMessage,
  invalidate,
  onSuccess,
  onError,
}: UseFormSubmitOptions<TInput, TResult>) {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return async (data: TInput, form: UseFormReturn<TInput>): Promise<void> => {
    try {
      const result = await mutate(data)
      const title =
        typeof successMessage === 'function' ? successMessage(result, data) : successMessage
      toast({ intent: 'success', title, testid: 'form-submit-success-toast' })
      const resolved = typeof invalidate === 'function' ? invalidate(result, data) : invalidate
      const keys = toQueryKeyList(resolved)
      await Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })))
      onSuccess?.(result)
    } catch (err) {
      if (onError && (await onError(err, form)) === true) return
      await mapServerErrors(err, form)
    }
  }
}

function toQueryKeyList(invalidate: QueryKey | QueryKey[] | undefined): QueryKey[] {
  if (invalidate == null) return []
  // A single QueryKey is itself an array (`unknown[]`), so we have to detect
  // the "list of keys" shape by checking the first element — if it's also an
  // array, we have a list-of-keys; otherwise a single key.
  if (invalidate.length > 0 && Array.isArray(invalidate[0])) {
    return invalidate as QueryKey[]
  }
  return [invalidate as QueryKey]
}
