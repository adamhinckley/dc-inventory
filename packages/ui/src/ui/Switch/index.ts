/**
 * Toggle switch backed by Base UI's Switch.Root + Switch.Thumb with a
 * density variant. Pure UI — no RHF coupling.
 *
 * @when Boolean values in forms (via `Form.Switch`'s RHF wrapper) or
 *   compact toggles in the FilterBar's BooleanEditor. Anywhere a binary
 *   on/off control needs to read like a switch rather than a checkbox.
 * @avoid Binary opt-ins inside cards or rows where a checkbox reads
 *   more naturally — use `Checkbox`.
 * @variants density (comfortable | compact)
 */
export { Switch, type SwitchProps } from './Switch'
