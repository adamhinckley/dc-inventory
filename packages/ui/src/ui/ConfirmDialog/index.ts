/**
 * `useConfirmDialog` is **action-system infrastructure** — a hook that
 * returns `{ confirm, dialog }`, where `confirm(config)` returns a
 * Promise resolving with the user's choice. Designed for imperative
 * async action handlers that need to ask "are you sure?" inline:
 *
 * ```ts
 * if (!await ctx.confirm({ title: 'Delete?', destructive: true })) return
 * await deleteMutation.mutateAsync(record.id)
 * ```
 *
 * Mount the returned `dialog` ReactNode **once**, typically at a provider
 * root that exposes `confirm` to descendants via context (see
 * `ActionCtxProvider` in the resource system). Do **not** call this hook
 * per-call-site — the slot is meant to be shared.
 *
 * @when Action runtimes that need linear `await ctx.confirm(...)` flows,
 *   chained confirmations ("are you sure?" then "really sure?"), or any
 *   place where async action handlers should stay readable as
 *   top-to-bottom code.
 *
 * @avoid Declarative one-off confirmations on a single button (e.g., a
 *   single "Delete account" page). For those, compose `<Dialog>`
 *   directly and manage open state with `useState` — the hook's
 *   slot-mount requirement adds complexity without paying off until
 *   there are multiple async confirmation call sites in one subtree.
 *
 * @avoid Mounting the returned `dialog` more than once in the same
 *   subtree. The slot is single-instance — the second mount just
 *   shadows the first.
 *
 * @example
 * // 1. Mount once at a provider root and forward `confirm` via context.
 * function ActionCtxProvider({ children }) {
 *   const { confirm, dialog } = useConfirmDialog()
 *   return (
 *     <ActionCtxContext value={{ confirm }}>
 *       {children}
 *       {dialog}
 *     </ActionCtxContext>
 *   )
 * }
 *
 * // 2. Consumer calls `await confirm(...)` from any async action handler.
 * function DeleteButton({ record }) {
 *   const { confirm } = useActionCtx()
 *   async function onClick() {
 *     if (!await confirm({ title: `Delete ${record.name}?`, destructive: true })) return
 *     await deleteRecord(record.id)
 *   }
 *   return <Button onClick={onClick} variant="destructive">Delete</Button>
 * }
 */
export { useConfirmDialog, type ConfirmDialogConfig } from './ConfirmDialog'
