'use client'

/**
 * Free-form tag input. Renders existing tags as dismissible chips next to a
 * typing surface; Enter, comma, or paste-with-commas commits tokens.
 *
 * @when Editing a `string[]` field in a form — company names, email aliases,
 *   free-form labels. Wraps via `Form.Field` with `kind: 'tags'`.
 * @avoid Constrained option lists — use `Combobox` / `Form` `kind: 'multiselect'`.
 *   Display-only — use `TagList`. Single value — use `TextInput`.
 * @variants density (comfortable | compact)
 */
export { TagInput, type TagInputProps } from './TagInput'
