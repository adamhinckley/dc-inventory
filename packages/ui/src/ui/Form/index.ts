'use client'

import {
  FormRoot,
  FormFieldset,
  FormField,
  FormLabel,
  FormTextInput,
  FormTextarea,
  FormCombobox,
  FormSelect,
  FormAutocomplete,
  FormDateInput,
  FormDateRangeInput,
  FormNumberInput,
  FormNumberRangeInput,
  FormTagInput,
  FormPhoneInput,
  FormSwitch,
  FormCheckbox,
  FormError,
  FormDescription,
  FormRootError,
  FormActions,
  FormSubmit,
} from './Form'

export type { FormProps, FormFieldProps, FormSubmitProps } from './Form'
export { useFormSubmit } from './Form.hook'
export type { UseFormSubmitOptions } from './Form.hook'

/**
 * Scroll the first validation error in a form into view (and focus it, for real
 * inputs). Wired automatically by `Form` on a failed `handleSubmit`; export it
 * for multi-step forms that gate advancement with a manual `form.trigger()`,
 * which has no submit event to trigger the built-in scan. Pass the `<form>` node.
 */
export { scrollToFirstError } from './Form'

/**
 * Schema-validated form. Wraps React Hook Form with a Zod resolver and
 * exposes Base UI form primitives (Field, Label, Control, Error) wired into
 * RHF's controlled-state model.
 *
 * @when Any user-input form: account creation, settings, multi-step flows.
 *   Anywhere you need validation, server-error mapping, and submit state.
 * @avoid Toolbar controls (filter inputs, search boxes) that don't submit and
 *   have no labels/errors — use raw inputs. Single-checkbox confirmations —
 *   use a plain Base UI Checkbox.
 */
export const Form = Object.assign(FormRoot, {
  Fieldset: FormFieldset,
  Field: FormField,
  Label: FormLabel,
  TextInput: FormTextInput,
  Textarea: FormTextarea,
  Combobox: FormCombobox,
  Select: FormSelect,
  Autocomplete: FormAutocomplete,
  DateInput: FormDateInput,
  DateRangeInput: FormDateRangeInput,
  NumberInput: FormNumberInput,
  NumberRangeInput: FormNumberRangeInput,
  TagInput: FormTagInput,
  PhoneInput: FormPhoneInput,
  Switch: FormSwitch,
  Checkbox: FormCheckbox,
  Error: FormError,
  Description: FormDescription,
  RootError: FormRootError,
  Actions: FormActions,
  Submit: FormSubmit,
})
