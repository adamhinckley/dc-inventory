/**
 * Typeahead-filterable option picker backed by Base UI's Combobox.
 * Single or multi mode; static, async, or external-state options;
 * density variant for form vs filter chrome. Optional `helperText`
 * stacks under the control.
 *
 * @when Picking from a list where typeahead filtering matters — long
 *   option lists, FilterBar select / multiselect editors. Cube-backed
 *   dimensions resolved through the resource-system dispatchers (which
 *   call `useFilterOptions`).
 * @avoid Short fixed option lists where typeahead isn't needed (status,
 *   role, sort order) — use `Select`. Boolean / on-off values — use
 *   `Select` for a dropdown UX, or `Switch` / `Checkbox` for an inline
 *   toggle. Free-form text with optional suggestions — use `Autocomplete`.
 *   Server-driven typeahead — not yet supported; surface as a follow-up.
 * @variants density (comfortable | compact)
 */
export {
  Combobox,
  filterComboboxOptionsForQuery,
  type ComboboxProps,
} from './Combobox'
