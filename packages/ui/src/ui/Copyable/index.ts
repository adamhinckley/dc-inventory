import {
  CopyableText as CopyableTextImpl,
  CopyableLongText as CopyableLongTextImpl,
} from './Copyable'

/**
 * Inline label paired with a copy-to-clipboard button. Renders the label as
 * a `<span>` with an always-visible copy button.
 *
 * @when Short identifiers users routinely copy — IDs, hashes, slugs, emails
 *   in detail panels and table cells.
 * @avoid Long-form text or anything that needs line clamping — use
 *   `CopyableLongText`. Standalone icon-only buttons unrelated to copying —
 *   use `IconButton`.
 */
export const CopyableText = CopyableTextImpl

/**
 * Multi-line text block clamped to `lineClamp` lines (default 3) with a
 * hover-revealed copy button.
 *
 * @when Longer text users may want to copy verbatim — descriptions, notes,
 *   raw payloads in detail views.
 * @avoid Single-line identifiers — use `CopyableText`. Editable content —
 *   use a textarea inside a `Form.Field`.
 * @variants lineClamp (number, default 3).
 */
export const CopyableLongText = CopyableLongTextImpl
