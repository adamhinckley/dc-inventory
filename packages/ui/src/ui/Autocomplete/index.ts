/**
 * Free-form text input with optional suggestion list. Single-value;
 * accepts arbitrary text or values picked from suggestions.
 *
 * @when Tag-style inputs, address autocompletion with custom values,
 *   search-with-suggestions, any field where the user might type
 *   something not in the list.
 * @avoid Constrained option lists (the user must pick one of the
 *   provided options) — use `Combobox`. Pure free-form text with no
 *   suggestions — use `TextInput`.
 * @variants density (comfortable | compact)
 */
export { Autocomplete, type AutocompleteProps } from './Autocomplete'
