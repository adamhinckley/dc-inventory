/**
 * Formatted timestamp display. Coerces an unknown value to a string and
 * formats via the shared `formatDate` helper.
 *
 * @when Any column or field showing a date or datetime — `created_at`,
 *   `updated_at`, `last_seen`. Pass `format="short"` for compact cells.
 * @avoid Computing display strings yourself — pass the raw ISO value
 *   here so all timestamps share formatting.
 */
export { Timestamp, timestampCell } from './Timestamp'
