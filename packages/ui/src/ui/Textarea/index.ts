/**
 * Multi-line text input with density and resize variants. Plain
 * `<textarea>` under the hood — no Base UI, no hooks. Dual-renderable.
 *
 * @when Form fields that take multi-line text — descriptions, notes,
 *   long-form messages. Use via `Form.Textarea` (RHF wrapper) inside
 *   forms.
 * @avoid Single-line input — use `TextInput`. Filter contexts —
 *   `textarea` filter kind collapses to single-line `TextInput` per
 *   D5; the `Textarea` primitive isn't rendered in FilterBar.
 * @variants density (comfortable | compact), resize (none | y | x | both)
 */
export { Textarea, type TextareaProps } from './Textarea'
