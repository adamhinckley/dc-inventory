/**
 * Single-line text input with a density variant for form-comfortable vs
 * filter-compact chrome. Optional `label`, `helperText`, and `error` stack
 * around the control. Plain `<input>` under the hood — no Base UI.
 * Dual-renderable.
 *
 * @when The default text-style control in forms (via `Form.TextInput`)
 *   and the FilterBar's text editor (`density="compact"`). Single-line
 *   non-RHF text inputs anywhere in the app.
 * @avoid Multi-line text — use `Textarea`. Free-form input with
 *   suggestions — use `Autocomplete` (Phase 5). Constrained option lists
 *   — use `Combobox` (Phase 4).
 * @variants density (comfortable | compact)
 */
export { TextInput, type TextInputProps } from './TextInput'
