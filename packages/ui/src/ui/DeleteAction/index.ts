export type { DeleteActionProps } from './DeleteAction'

/**
 * Type-to-confirm delete button. Renders a destructive Delete button
 * that opens a small dialog requiring the user to type the entity's
 * name exactly before the destructive action enables.
 *
 * @when High-blast-radius deletes (account, organization, license)
 *   where a single click is too easy.
 * @avoid Low-stakes deletes (a single tag, a draft) — use
 *   `useConfirmDialog` for a simpler "Are you sure?" flow. Bulk deletes
 *   — render a custom dialog with selection counts.
 */
export { DeleteAction } from './DeleteAction'
