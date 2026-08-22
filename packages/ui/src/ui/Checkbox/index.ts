/**
 * Checkbox backed by Base UI's Checkbox.Root + Checkbox.Indicator with a
 * density variant. Pure UI — no RHF coupling.
 *
 * @when Multi-select option lists in the FilterBar (compact density),
 *   binary opt-ins inside row-style content, list-pickers where each item
 *   is a checkbox. Use via `Form.Checkbox` (RHF wrapper) inside forms.
 * @avoid On/off toggles where the visual should read as a switch — use
 *   `Switch`. Single-select option lists — use `Combobox` (Phase 4).
 * @variants density (comfortable | compact)
 */
export { Checkbox, type CheckboxProps } from './Checkbox'
