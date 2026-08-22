/**
 * Opaque resource id display with copy-to-clipboard.
 *
 * @when Rendering a resource's `id` field in tables, detail panels, or
 *   anywhere a UUID needs to be visible and copyable.
 * @avoid Truncating ids to "first 8 chars" — use `CopyableText` directly
 *   if you need a different display string. Non-id values — use
 *   `CopyableText` for arbitrary copyable strings.
 */
export { IdCell, idCell } from './IdCell'
