'use client'

/**
 * Constrained option picker backed by Base UI's Select. Trigger button
 * shows the selected option, opens a popup list. No typeahead filtering;
 * density variant for form vs filter chrome.
 *
 * @when Picking from a short, known list where the user doesn't need to
 *   type to filter — status, role, account type, sort order. Inside a
 *   `<Form>`, prefer `Form.Select` (RHF wrapper that auto-wires
 *   `data-invalid`).
 * @avoid Long option lists where typeahead filtering matters — use
 *   `Combobox`. Free-form text with optional suggestions — use
 *   `Autocomplete`. On/off binary values — use `Switch` / `Checkbox`.
 * @variants density (comfortable | compact), display (label | value)
 */
export { Select, type SelectProps } from './Select'
