// @ts-nocheck — resource FieldConfig wiring is stubbed until x-table maps here.
'use client'

import { use, useEffect, type ComponentPropsWithRef, type ReactNode } from 'react'
import {
  Controller,
  FormProvider,
  useForm,
  useFormContext,
  useFormState,
  type DefaultValues,
  type FieldValues,
  type UseFormReturn,
} from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { z, ZodTypeAny } from 'zod'
import { CircleAlert } from 'lucide-react'
import { Field as BaseField } from '@base-ui-components/react/field'
import { Fieldset as BaseFieldset } from '@base-ui-components/react/fieldset'
import { Switch } from '#ds/ui/Switch'
import { Checkbox } from '#ds/ui/Checkbox'
import { TextInput, type TextInputProps } from '#ds/ui/TextInput'
import { Textarea, type TextareaProps } from '#ds/ui/Textarea'
import { Combobox, type ComboboxProps } from '#ds/ui/Combobox'
import { Select, type SelectProps } from '#ds/ui/Select'
import { Autocomplete, type AutocompleteProps } from '#ds/ui/Autocomplete'
import { DateInput, type DateInputProps } from '#ds/ui/DateInput'
import {
  DateRangeInput,
  type DateRangeInputProps,
  type DateRangeValue,
} from '#ds/ui/DateRangeInput'
import { NumberInput, type NumberInputProps } from '#ds/ui/NumberInput'
import {
  NumberRangeInput,
  type NumberRangeInputProps,
  type NumberRangeValue,
} from '#ds/ui/NumberRangeInput'
import { TagInput, type TagInputProps } from '#ds/ui/TagInput'
import { PhoneInput, type PhoneInputProps } from '#ds/ui/PhoneInput'
import { LoadingButton, type LoadingButtonProps } from '#ds/ui/LoadingButton'
import { parsePhoneNumberFromString } from 'libphonenumber-js'
import { PII_MASK_CLASS } from '#shared/constants/pii-mask'
import { FormFieldContext } from '#shared/form/form-field-context'
import { useFilterOptions } from '#shared/resource/use-filter-options'
import type {
  FieldConfig,
  FormFieldMeta,
  FormFieldSlot,
  FormRenderFn,
  Option,
} from '#shared/resource/types'
import { cva } from 'class-variance-authority'
import { cn } from '#cn'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Two type parameters because Zod schemas with `.default()` or transforms
 * have an INPUT type (what the user / form state holds before parsing) that
 * differs from the OUTPUT type (what `parse()` returns). React Hook Form's
 * default-values + render-state run on input; `onSubmit` receives output.
 *
 * `TSchema` is the Zod schema itself; we derive `z.input<TSchema>` and
 * `z.output<TSchema>` so callers don't have to pass them explicitly.
 *
 * `onSubmit` receives the form instance as a second argument so consumers
 * can call `mapServerErrors(err, form)` from the catch block — the form
 * is needed to attach server-validation messages to fields.
 */
export interface FormProps<TSchema extends ZodTypeAny> extends Omit<
  ComponentPropsWithRef<'form'>,
  'onSubmit'
> {
  schema: TSchema
  defaultValues?: DefaultValues<z.input<TSchema>>
  onSubmit: (
    data: z.output<TSchema>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    form: UseFormReturn<any>,
  ) => void | Promise<void>
  children: ReactNode
  /**
   * Required. Format: `{feature}-{view}-{element}`.
   * Example: `accounts-create-form`.
   * See `.claude/rules/concepts/testid.md` for the full spec.
   */
  'data-testid'?: string
}

/**
 * Three call shapes:
 *
 * 1. **By field reference** — `<Form.Field field={userFields.email} />`. Label
 *    comes from `field.label`; the default control comes from `field.form`.
 *    Use this for any field that lives in a `defineFields()`-wrapped map.
 *
 * 2. **By name + form metadata** — `<Form.Field name="password" label="Password"
 *    form={{ kind: 'text' }} />`. Use this for form-only inputs that aren't
 *    resource attributes (passwords, confirmation toggles, send-invite
 *    flags). The Zod schema for the form is the source of truth for "is this
 *    field in the form"; the field map stays clean.
 *
 * 3. **By name + custom children** — `<Form.Field name="x">{customControl}</Form.Field>`.
 *    Escape hatch for ad-hoc controls without a `FormFieldSlot`. Caller
 *    composes Label + control + Error themselves; this variant just provides
 *    RHF wiring.
 */
export interface FormFieldByRefProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  field: FieldConfig<any>
  name?: never
  form?: never
  /** Override the label text without rebuilding the field. */
  label?: ReactNode
  /** Show a required marker (asterisk + sr-only "required") on the label. */
  required?: boolean
  /** Helper text shown beneath the control. */
  description?: ReactNode
  /** Custom control. Replaces the auto-rendered input but keeps label + error wiring. */
  children?: ReactNode
  /**
   * Override the field's `pii` flag for this rendering. Useful when a
   * generally-PII attribute should not be masked in a specific form
   * (rare), or to apply masking when the field config didn't.
   */
  pii?: boolean
  /**
   * Render this field as a non-editable display of its current value.
   * The Controller still owns the value and submits it with the form;
   * the input chrome is replaced by a static value surface.
   *
   * Use only when the value is supplied from surrounding context
   * (e.g. `<Form defaultValues={{ account_id: accountId }}>`) and is
   * intended for display, not user editing. Not a generic "disable"
   * toggle — disabling an otherwise-editable input is a different
   * concern.
   *
   * Renderers that read other fields off `record` will see an empty
   * record in read-only mode (`{}`) and may render incorrectly — any
   * `record.foo` access yields `undefined`. Affects `NameCell`-style
   * composites, chips whose color/state derive from `record`, and
   * renderers that early-return on a missing `record` shape. Use the
   * `children` escape hatch on `Form.Field` for cross-field
   * composites.
   *
   * If the prefilled value fails the form's Zod schema, the failure
   * is silent in production (no inline error; submission blocked
   * without visible feedback). A dev-only `console.warn` from
   * `FormReadOnlyValue` flags the wiring bug during development.
   */
  readOnly?: boolean
  /**
   * Optional override. Format: `{feature}-{view}-{element}`.
   * Defaults to `form-${field.name}` when omitted.
   * Example override: `accounts-create-form-email-input`.
   * See `.claude/rules/concepts/testid.md`.
   */
  'data-testid'?: string
}

export interface FormFieldByNameWithFormProps {
  name: string
  form: FormFieldSlot
  field?: never
  label: ReactNode
  /** Show a required marker (asterisk + sr-only "required") on the label. */
  required?: boolean
  description?: ReactNode
  /** Custom control. Replaces the auto-rendered input but keeps label + error wiring. */
  children?: ReactNode
  /**
   * Mark this field's control for marker.io PII masking. Use when the
   * field is form-only (no `FieldConfig`) but still renders user data —
   * e.g. an account picker whose option labels are account names.
   */
  pii?: boolean
  /**
   * See {@link FormFieldByRefProps.readOnly}. Note: this shape has no
   * `FieldConfig`, so the read-only path always renders the raw
   * `String(value)` — formatters like `IdCell` or `Timestamp` won't
   * appear. Declare a `FieldConfig` and use the `field` shape if you
   * need formatted read-only output.
   */
  readOnly?: boolean
  /**
   * Optional override. Format: `{feature}-{view}-{element}`.
   * Defaults to `form-${name}` when omitted.
   * Example override: `accounts-create-form-email-input`.
   * See `.claude/rules/concepts/testid.md`.
   */
  'data-testid'?: string
}

export interface FormFieldByNameProps {
  name: string
  form?: never
  field?: never
  label?: never
  description?: never
  children: ReactNode
}

export type FormFieldProps =
  | FormFieldByRefProps
  | FormFieldByNameWithFormProps
  | FormFieldByNameProps

export interface FormFieldsetProps extends ComponentPropsWithRef<'fieldset'> {
  label?: string
}

export type FormLabelProps = ComponentPropsWithRef<'label'> & {
  /**
   * Append a required marker to the label: a decorative asterisk plus an
   * `sr-only` "required" so the requirement is conveyed to screen readers too,
   * not by the asterisk's color/shape alone.
   */
  required?: boolean
}

export type FormTextInputProps = Omit<
  TextInputProps,
  'name' | 'value' | 'onChange' | 'onBlur' | 'data-testid'
> & {
  'data-testid'?: string
}

export type FormTextareaProps = Omit<
  TextareaProps,
  'name' | 'value' | 'onChange' | 'onBlur' | 'data-testid'
> & {
  'data-testid'?: string
}

export type FormComboboxProps = Omit<
  ComboboxProps,
  'value' | 'onChange' | 'onBlur' | 'name' | 'data-testid'
> & {
  'data-testid'?: string
}

export type FormSelectProps<T extends string | number | boolean = string> = Omit<
  SelectProps<T>,
  'value' | 'onChange' | 'onBlur' | 'name' | 'data-testid' | 'multiple'
> & {
  'data-testid'?: string
}

export type FormAutocompleteProps = Omit<
  AutocompleteProps,
  'value' | 'onChange' | 'onBlur' | 'name' | 'data-testid'
> & {
  'data-testid'?: string
}

export type FormDateInputProps = Omit<
  DateInputProps,
  'value' | 'onChange' | 'onBlur' | 'name' | 'data-testid'
> & {
  'data-testid'?: string
}

export type FormDateRangeInputProps = Omit<
  DateRangeInputProps,
  'value' | 'onChange' | 'data-testid'
> & {
  'data-testid'?: string
}

export type FormNumberInputProps = Omit<
  NumberInputProps,
  'value' | 'onChange' | 'onBlur' | 'name' | 'data-testid'
> & {
  'data-testid'?: string
}

export type FormNumberRangeInputProps = Omit<
  NumberRangeInputProps,
  'value' | 'onChange' | 'data-testid'
> & {
  'data-testid'?: string
}

export type FormTagInputProps = Omit<
  TagInputProps,
  'value' | 'onChange' | 'onBlur' | 'name' | 'data-testid'
> & {
  'data-testid'?: string
}

export type FormPhoneInputProps = Omit<
  PhoneInputProps,
  'value' | 'onChange' | 'onBlur' | 'name' | 'data-testid'
> & {
  'data-testid'?: string
}

export type FormSwitchProps = Omit<
  ComponentPropsWithRef<'button'>,
  'name' | 'value' | 'onChange' | 'onBlur' | 'type'
>

export type FormCheckboxProps = Omit<
  ComponentPropsWithRef<'button'>,
  'name' | 'value' | 'onChange' | 'onBlur' | 'type'
> & {
  label?: ReactNode
}

export type FormErrorProps = ComponentPropsWithRef<'div'>

export type FormDescriptionProps = ComponentPropsWithRef<'p'>

// ---------------------------------------------------------------------------
// FormRoot
// ---------------------------------------------------------------------------

/**
 * Form root. Creates the React Hook Form instance with a Zod resolver and
 * provides it via FormProvider so descendants can call `useFormContext()`.
 * Renders a `<form>` element with `gap-form-section` between children.
 *
 * @when The outermost wrapper for any validated form. Always exactly one per form.
 * @avoid Wrapping non-form UI just to get RHF context — sub-components like
 *   `Form.Field` only work as descendants of this root.
 * @example
 * <Form schema={zUser} defaultValues={{ name: '' }} onSubmit={handle}>
 *   <Form.Field field={userFields.name} />
 *   <Form.Actions>
 *     <Form.Submit>Save</Form.Submit>
 *   </Form.Actions>
 * </Form>
 */
export function FormRoot<TSchema extends ZodTypeAny>({
  schema,
  defaultValues,
  onSubmit,
  children,
  ref,
  className,
  ...rest
}: FormProps<TSchema>) {
  type Input = z.input<TSchema> & FieldValues
  type Output = z.output<TSchema>
  const form = useForm<Input, unknown, Output>({
    resolver: zodResolver(schema) as never,
    defaultValues: defaultValues as DefaultValues<Input>,
  })

  return (
    <FormProvider {...form}>
      <form
        ref={ref}
        className={cn('flex flex-col gap-form-section', className)}
        onSubmit={form.handleSubmit(
          (data) => onSubmit(data, form as UseFormReturn<FieldValues>),
          // On a failed submit, scroll the first error into view. RHF's built-in
          // `shouldFocusError` is a no-op here — our input wrappers bind their own
          // `ref`, never the Controller's `field.ref`, so there's no node for RHF
          // to focus. The submit event targets the <form>, so `event.target` is
          // the node to search — no ref to own (and reading a ref in this
          // render-created closure trips the React Compiler ref rule).
          (_errors, event) => scrollToFirstError(event?.target as HTMLFormElement | null),
        )}
        {...rest}
      >
        {children}
      </form>
    </FormProvider>
  )
}

/**
 * On a failed submit, bring the first validation error into view. Targets both
 * invalid field controls (`[data-invalid="true"]`) and the standalone error
 * messages that have no control to focus — `Form.RootError` (`role="alert"`)
 * and array-level section errors (the `form-error` text role) — then picks the
 * one highest on screen so the user lands on the first problem regardless of
 * which kind it is. Focus follows for real inputs (keyboard users); the scroll
 * is smooth unless the user prefers reduced motion. Scrolls within whatever
 * scroll container the form lives in (page, `Dialog.Body`, `Drawer.Body`).
 *
 * Exported so multi-step forms that advance via `form.trigger()` (rather than
 * `handleSubmit`) can reuse the same first-error scan — `handleSubmit`'s invalid
 * callback wires this automatically, but a manual `trigger()` gate does not, so
 * such callers pass their own `<form>` node (e.g. `bodyRef.current?.closest('form')`).
 */
export function scrollToFirstError(formEl: HTMLFormElement | null) {
  if (!formEl) return
  // Defer a frame so the error DOM (Base UI Field.Error, SectionError,
  // RootError) has committed before we measure positions.
  requestAnimationFrame(() => {
    const candidates = formEl.querySelectorAll<HTMLElement>(
      '[data-invalid="true"], [role="alert"], .form-error',
    )
    let target: HTMLElement | null = null
    let top = Infinity
    for (const el of candidates) {
      const elTop = el.getBoundingClientRect().top
      if (elTop < top) {
        top = elTop
        target = el
      }
    }
    if (!target) return
    // `matchMedia` / `scrollIntoView` are absent in jsdom (and old engines);
    // guard both so a test env (or a headless render) doesn't throw inside this
    // deferred frame — the scroll is a progressive enhancement, not load-bearing.
    const reduceMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    target.scrollIntoView?.({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' })
    // Only inputs are focusable; focusing an error <p> or a wrapper div is a
    // harmless no-op, so gate on the invalid-control marker to move focus only
    // when there's actually something to type into.
    if (target.matches('[data-invalid="true"]')) target.focus({ preventScroll: true })
  })
}

// ---------------------------------------------------------------------------
// FormFieldset — Base UI Fieldset.Root + Fieldset.Legend
// ---------------------------------------------------------------------------

/**
 * Fieldset grouping. Renders `<fieldset>` with an optional `<legend>` styled
 * by the `form-section-label` text role.
 *
 * @when Grouping related fields under a heading ("Account Details",
 *   "License Allocation"). Multiple groups are common.
 */
export function FormFieldset({ ref, className, label, children, ...rest }: FormFieldsetProps) {
  return (
    <BaseFieldset.Root
      ref={ref}
      className={cn('flex flex-col gap-field-group', className)}
      {...rest}
    >
      {label && <BaseFieldset.Legend className="form-section-label">{label}</BaseFieldset.Legend>}
      {children}
    </BaseFieldset.Root>
  )
}

// ---------------------------------------------------------------------------
// FormField — RHF Controller + Base UI Field.Root
// ---------------------------------------------------------------------------

/**
 * Field row. Wires a single form value via RHF's `Controller`, provides Base
 * UI's `Field.Root` (handles invalid state, ARIA wiring), and either renders
 * Label + Control + Error automatically (`field`/`form` shapes) or passes
 * children through (`name + children` shape).
 *
 * @when Every field in a form. Pick the call shape that fits:
 *   - **By field reference** — pass a `defineFields()` entry: `<Form.Field field={f.email} />`
 *   - **By name + form metadata** — for form-only inputs not in a field map
 *   - **By name + custom children** — escape hatch for ad-hoc controls
 * @avoid Composing label/error manually in the auto-render shapes — let
 *   `field`/`form` resolve the control. Use the `children` shape only when
 *   the auto-render can't express what you need.
 */
export function FormField(props: FormFieldProps) {
  const { control } = useFormContext()

  // Resolve name + the body to render inside the controlled context.
  const resolved = resolveFieldProps(props)

  return (
    <Controller
      name={resolved.name}
      control={control}
      render={({ field, fieldState }) => (
        <BaseField.Root invalid={Boolean(fieldState.error)} className="flex flex-col gap-field">
          <FormFieldContext value={{ field, fieldState, error: fieldState.error }}>
            {resolved.body}
          </FormFieldContext>
        </BaseField.Root>
      )}
    />
  )
}

/**
 * Pick the name + body for a FormField call. The legacy `{ name, children }`
 * shape passes children through verbatim. The new `{ field, ... }` shape
 * renders Label + (Description?) + (Control | children) + Error so the
 * caller doesn't have to compose those pieces.
 *
 * Two distinct names are resolved here:
 *   - `name` (returned) — the RHF Controller key. Falls back to the field's
 *     display `name`, but a `form.key` override (set when the display key
 *     and form-schema key diverge, e.g., `source.name` displays, `source_id`
 *     writes) wins.
 *   - `testId` (passed into `FormControl`) — the display key, always
 *     `form-${field.name}`. The testid identifies the visible input by what
 *     a test author reads in the UI; it does not follow the form-schema key.
 */
function resolveFieldProps(props: FormFieldProps): { name: string; body: ReactNode } {
  if ('field' in props && props.field) {
    const labelText = props.label ?? props.field.label
    const formMeta = props.field.form
    const rhfName =
      formMeta && !('render' in formMeta) && formMeta.key ? formMeta.key : props.field.name
    const testId = props['data-testid'] ?? `form-${props.field.name}`
    // Per-render override beats the field config default.
    const pii = props.pii ?? props.field.pii
    // `checkbox` always carries its label inline, to the right of the box
    // (the browser-native pattern), via FormCheckbox's `label` prop — the
    // stacked FormLabel is never rendered for this kind. Custom `children`
    // for a checkbox-kind field must supply their own label
    // (e.g. `<Form.Checkbox label="...">`).
    const inlineLabel = !!formMeta && !('render' in formMeta) && formMeta.kind === 'checkbox'
    return {
      name: rhfName,
      body: (
        <>
          {!inlineLabel && <FormLabel required={props.required}>{labelText}</FormLabel>}
          {props.readOnly
            ? renderReadOnlyControl(
                props.field.form,
                props.field,
                testId,
                pii,
                inlineLabel ? labelText : undefined,
              )
            : (props.children ?? (
                <FormControl
                  form={props.field.form}
                  testId={testId}
                  pii={pii}
                  label={inlineLabel ? labelText : undefined}
                />
              ))}
          {props.description && <FormDescription>{props.description}</FormDescription>}
          {!props.readOnly && <FormError />}
        </>
      ),
    }
  }
  if ('form' in props && props.form) {
    const testId = props['data-testid'] ?? `form-${props.name}`
    const pii = props.pii
    const inlineLabel = !('render' in props.form) && props.form.kind === 'checkbox'
    return {
      name: props.name,
      body: (
        <>
          {!inlineLabel && <FormLabel required={props.required}>{props.label}</FormLabel>}
          {props.readOnly
            ? renderReadOnlyControl(
                props.form,
                undefined,
                testId,
                pii,
                inlineLabel ? props.label : undefined,
              )
            : (props.children ?? (
                <FormControl
                  form={props.form}
                  testId={testId}
                  pii={pii}
                  label={inlineLabel ? props.label : undefined}
                />
              ))}
          {props.description && <FormDescription>{props.description}</FormDescription>}
          {!props.readOnly && <FormError />}
        </>
      ),
    }
  }
  return { name: props.name, body: props.children }
}

/**
 * Picks the read-only rendering for a `Form.Field`. Most kinds fall
 * through to `FormReadOnlyValue` (the static value surface), but
 * `kind: 'boolean'` keeps the switch chrome and renders it `disabled` —
 * a thumb-position read is much faster than "Yes" / "No" text, and a
 * disabled switch is unambiguously non-interactive. `kind: 'checkbox'`
 * does the same with the checkbox chrome, carrying the field's label
 * inline (`label`) just like the editable rendering.
 */
function renderReadOnlyControl(
  form: FormFieldSlot | undefined,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  field: FieldConfig<any> | undefined,
  testId: string,
  pii?: boolean,
  label?: ReactNode,
): ReactNode {
  if (form && !('render' in form)) {
    if (form.kind === 'boolean') return <FormSwitch disabled data-testid={testId} />
    if (form.kind === 'checkbox')
      return <FormCheckbox disabled label={label} data-testid={testId} />
    // Phone reads as the formatted international number (`+1 555 123 4567`),
    // not the raw E.164 the field stores. PII by default, like the editable
    // control.
    if (form.kind === 'phone')
      return (
        <FormReadOnlyValue
          field={field}
          testId={testId}
          pii={pii ?? true}
          format={formatPhoneForDisplay}
        />
      )
  }
  return <FormReadOnlyValue field={field} testId={testId} pii={pii} />
}

/** E.164 → grouped international display; falls back to the raw value. */
function formatPhoneForDisplay(value: unknown): ReactNode {
  if (typeof value !== 'string' || value === '') return null
  // Non-throwing parser: `undefined` for unparseable input → show it raw.
  const parsed = parsePhoneNumberFromString(value)
  return parsed ? parsed.formatInternational() : value
}

/**
 * Non-editable value surface inside a `Form.Field`. Reads the current
 * value from `FormFieldContext` and renders it through the field's
 * `render` function (when available) or as a plain string. The
 * Controller above still owns the value, so the field submits with
 * the form even though there's no editable input.
 *
 * Visual: same shape as the editable input chrome
 * (`border-border-field`, `rounded-interactable`, `px-input-x`,
 * `py-input-y`, `text-input`) so rows align in a form, but
 * `bg-transparent` (vs. editable's `bg-surface-card`) makes the
 * non-editable rows visibly distinct against the page surface — they
 * don't lie about being inputs. `cursor-default` signals "not an
 * input" without claiming disabled state (`cursor-not-allowed`) or
 * inviting text entry (`cursor-text`); `select-text` keeps the value
 * copyable.
 *
 * Renderers that read other fields off `record` see an empty record
 * (`{}`) and may render incorrectly. Use the `children` escape hatch
 * on `Form.Field` for cross-field composites.
 *
 * The component renders inside `<BaseField.Control render={...}>` so
 * Base UI's id propagation still wires `<label htmlFor>` to this
 * surface. No `aria-readonly` — that attribute is only valid on roles
 * like `textbox` / `checkbox` / `combobox`, and the absence of any
 * form control here is itself the screen-reader signal.
 *
 * Dev-only `console.warn` fires when `fieldState.error` is present —
 * a read-only field with a validation error is a wiring bug (the
 * prefill in `defaultValues` doesn't satisfy the schema). Since the
 * inline `FormError` is suppressed for read-only rows, the warn is
 * the only signal in dev.
 */
function FormReadOnlyValue({
  field,
  testId,
  pii,
  format,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  field?: FieldConfig<any>
  testId?: string
  pii?: boolean
  /**
   * Optional value formatter for kinds whose stored value differs from its
   * display (phone: E.164 → grouped international). Applied only when the
   * field has no `render` and the value is non-empty.
   */
  format?: (value: unknown) => ReactNode
}) {
  const ctx = use(FormFieldContext)
  const errorMessage = ctx?.fieldState.error?.message
  const fieldName = ctx?.field.name

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' && errorMessage && fieldName) {
      console.warn(
        `[Form] Read-only field "${fieldName}" has a validation error: ` +
          `${errorMessage}. Read-only fields suppress inline errors and ` +
          `submission is blocked silently. Check that defaultValues ` +
          `supplies a value that satisfies the schema.`,
      )
    }
  }, [errorMessage, fieldName])

  if (!ctx) return null
  const value = ctx.field.value

  let content: ReactNode
  if (field?.render) {
    content = field.render({ value, record: {} })
  } else if (value == null || value === '') {
    content = <span className="text-placeholder">—</span>
  } else if (format) {
    content = format(value)
  } else {
    content = String(value)
  }

  return (
    <BaseField.Control
      render={(props) => (
        <div
          {...props}
          className={cn(
            'w-full min-h-(--space-input-height) bg-transparent text-fg',
            'rounded-interactable border border-border-field px-input-x py-input-y text-input',
            'select-text cursor-default',
            pii && PII_MASK_CLASS,
          )}
          data-testid={testId}
          data-read-only="true"
        >
          {content}
        </div>
      )}
    />
  )
}

/**
 * Renders the default control for a `FormFieldSlot`. Branches on the
 * render-fn escape hatch first; otherwise dispatches on `form.kind`.
 * `text` and `textarea` map to `FormTextInput` / `FormTextarea`;
 * `number` and `number-range` use `FormNumberInput` / `FormNumberRangeInput`;
 * `date` and `date-range` use `FormDateInput` / `FormDateRangeInput`;
 * `select`/`multiselect` use `FormCombobox` (resolved through
 * `FormSelectControl` which calls `useFilterOptions`); `autocomplete`
 * uses `FormAutocomplete` (resolved through `FormAutocompleteControl`);
 * `boolean` uses `FormSwitch` and `checkbox` uses `FormCheckbox`. Every
 * `FieldKind` is now implemented — the dispatcher's switch is exhaustive.
 *
 * `testId` is auto-derived from the field's display name (`form-${name}`)
 * by `resolveFieldProps` and lands as `data-testid` on the input element
 * itself, not the wrapper. Caller-supplied `data-testid` on `<Form.Field>`
 * flows through standard prop spreading and overrides this default.
 */
function FormControl({
  form,
  testId,
  pii,
  label,
}: {
  form?: FormFieldSlot
  testId?: string
  pii?: boolean
  /**
   * The field's display label. Only consumed by the `checkbox` kind,
   * which renders it inline to the right of the box (`resolveFieldProps`
   * skips the stacked FormLabel for that kind).
   */
  label?: ReactNode
}) {
  if (!form) return <FormTextInput data-testid={testId} pii={pii} />

  if ('render' in form) {
    return <FormRenderInvoker render={form.render} />
  }

  switch (form.kind) {
    case 'text':
      return (
        <FormTextInput type="text" placeholder={form.placeholder} data-testid={testId} pii={pii} />
      )
    case 'email':
      return (
        <FormTextInput type="email" placeholder={form.placeholder} data-testid={testId} pii={pii} />
      )
    case 'url':
      return (
        <FormTextInput type="url" placeholder={form.placeholder} data-testid={testId} pii={pii} />
      )
    case 'password':
      return (
        <FormTextInput
          type="password"
          placeholder={form.placeholder}
          data-testid={testId}
          pii={pii}
        />
      )
    case 'number':
      return (
        <FormNumberInput
          placeholder={form.placeholder}
          min={form.min}
          max={form.max}
          step={form.step}
          stepper={form.stepper}
          data-testid={testId}
          pii={pii}
        />
      )
    case 'number-range':
      return (
        <FormNumberRangeInput min={form.min} max={form.max} step={form.step} data-testid={testId} />
      )
    case 'date':
      return (
        <FormDateInput
          min={form.min}
          max={form.max}
          yearNavigation={form.yearNavigation}
          data-testid={testId}
          pii={pii}
        />
      )
    case 'date-range':
      return <FormDateRangeInput min={form.min} max={form.max} data-testid={testId} />
    case 'textarea':
      return (
        <FormTextarea
          rows={form.rows}
          placeholder={form.placeholder}
          data-testid={testId}
          pii={pii}
        />
      )
    case 'select':
      return <FormSelectControl form={form} testId={testId} pii={pii} />
    case 'multiselect':
      return <FormSelectControl form={form} testId={testId} multiple pii={pii} />
    case 'autocomplete':
      return <FormAutocompleteControl form={form} testId={testId} pii={pii} />
    case 'boolean':
      return <FormSwitch data-testid={testId} />
    case 'checkbox':
      return <FormCheckbox label={label} data-testid={testId} />
    case 'tags':
      return <FormTagInput placeholder={form.placeholder} data-testid={testId} pii={pii} />
    case 'phone':
      return (
        <FormPhoneInput
          defaultCountry={form.defaultCountry}
          priorityCountries={form.priorityCountries}
          placeholder={form.placeholder}
          data-testid={testId}
          pii={pii}
        />
      )
  }
}

/**
 * Adapter that resolves `select` / `multiselect` form options (static,
 * async, or cube-backed) via `useFilterOptions` and passes the resolved
 * `{options, loading}` to `<FormCombobox>`. Used by `FormControl` for
 * the `select` and `multiselect` kinds.
 */
function FormSelectControl({
  form,
  multiple = false,
  testId,
  pii,
}: {
  form: Extract<FormFieldMeta, { kind: 'select' | 'multiselect' }>
  multiple?: boolean
  testId?: string
  pii?: boolean
}) {
  const { options, loading } = useFilterOptions(form.options, form.optionsSource)
  // Combobox handles multi-select; Select is single-select only. Force the
  // Combobox path for any multi-select form, regardless of `filterable`.
  // Combobox is also string-only (typeahead matches against text) — the cast
  // is safe because non-string options are only meaningful for single-select
  // pickers (e.g. a boolean Yes/No), which route to Select below.
  if (form.filterable || multiple) {
    return (
      <FormCombobox
        options={options as Option[]}
        loading={loading}
        multiple={multiple}
        placeholder={form.placeholder}
        data-testid={testId}
        pii={pii}
      />
    )
  }
  return (
    <FormSelect
      options={options}
      loading={loading}
      placeholder={form.placeholder}
      data-testid={testId}
      pii={pii}
    />
  )
}

/**
 * Adapter that resolves `autocomplete` form options through
 * `useFilterOptions` and passes the resolved `{options, loading}` to
 * `<FormAutocomplete>`. Used by `FormControl[autocomplete]`.
 */
function FormAutocompleteControl({
  form,
  testId,
  pii,
}: {
  form: Extract<FormFieldMeta, { kind: 'autocomplete' }>
  testId?: string
  pii?: boolean
}) {
  const { options, loading } = useFilterOptions(form.options, form.optionsSource)
  // Autocomplete suggestions are always string-valued. Non-string form
  // option types aren't meaningful here — typeahead matches against text.
  return (
    <FormAutocomplete
      options={options as Option[]}
      loading={loading}
      placeholder={form.placeholder}
      data-testid={testId}
      pii={pii}
    />
  )
}

/**
 * Adapter that pulls the RHF Controller state out of `FormFieldContext`
 * and invokes a `FormRenderFn`. Lives here (rather than as a hook the
 * render-fn calls) so authors of the render-fn don't need to know about
 * `FormFieldContext` at all — they receive `rhf` and `fieldState`
 * directly.
 *
 * `field` is omitted from the ctx because the render-fn route doesn't
 * have a back-pointer to the originating `FieldConfig` — only the slot
 * lands here. If a render-fn ever needs the field config, route through
 * `<Form.Field>{customControl}</Form.Field>` (the children escape hatch)
 * and capture the field reference in the caller's closure.
 */
function FormRenderInvoker({ render }: { render: FormRenderFn }) {
  const ctx = use(FormFieldContext)
  if (!ctx) return null
  return <>{render({ field: undefined as never, rhf: ctx.field, fieldState: ctx.fieldState })}</>
}

// ---------------------------------------------------------------------------
// FormLabel — Base UI Field.Label
// ---------------------------------------------------------------------------

/**
 * Field label. Renders `Field.Label` styled with the `form-label` text role.
 *
 * @when Inside a custom `Form.Field` body (the `children` shape). Auto-render
 *   shapes (`field`, `form`) include the label themselves.
 */
export function FormLabel({ ref, className, required, children, ...rest }: FormLabelProps) {
  return (
    <BaseField.Label ref={ref} className={cn('form-label', className)} {...rest}>
      {children}
      {required && (
        <>
          <span aria-hidden="true" className="ml-0.5 text-error">
            *
          </span>
          <span className="sr-only"> required</span>
        </>
      )}
    </BaseField.Label>
  )
}

// ---------------------------------------------------------------------------
// FormTextInput — RHF wrapper around the <TextInput> primitive
// ---------------------------------------------------------------------------

/**
 * RHF-bound text input. Reads field state from `FormFieldContext` (set by
 * `Form.Field`) and renders a `<TextInput density="comfortable">` wired
 * to the field's value/onChange/onBlur. Auto-derives
 * `data-testid={\`form-${field.name}\`}` and forwards `data-invalid`
 * from the field's error state.
 *
 * @when Inside a `Form.Field` for `kind: 'text'` / `'email'` / `'url'` /
 *   `'password'` (via the `type` prop), or any single-line text input in
 *   a Form. Default control auto-rendered by `FormControl[text]`; can
 *   also be used directly inside a custom `Form.Field` body.
 * @avoid Outside a `Form.Field` — the field context resolves to null.
 *   Multi-line text — use `Form.Textarea`. Toolbar / FilterBar inputs —
 *   use the bare `<TextInput density="compact">` primitive.
 */
export function FormTextInput({ ref, className, ...rest }: FormTextInputProps) {
  const ctx = use(FormFieldContext)

  if (!ctx) return null
  const { field, error } = ctx

  return (
    <BaseField.Control
      render={(props) => (
        <TextInput
          {...props}
          ref={ref}
          name={field.name}
          value={(field.value as string | number | undefined) ?? ''}
          onChange={field.onChange}
          onBlur={field.onBlur}
          className={className}
          data-invalid={error ? true : undefined}
          data-testid={`form-${field.name}`}
          {...rest}
        />
      )}
    />
  )
}

// ---------------------------------------------------------------------------
// FormTextarea — RHF wrapper around the <Textarea> primitive
// ---------------------------------------------------------------------------

/**
 * RHF-bound multi-line text input. Reads field state from
 * `FormFieldContext` and renders a `<Textarea density="comfortable">`
 * wired to the field. Auto-derives `data-testid` and forwards
 * `data-invalid` from the field's error state.
 *
 * @when Inside a `Form.Field` for `kind: 'textarea'`. Default control
 *   auto-rendered by `FormControl[textarea]`.
 * @avoid Outside a `Form.Field` — context resolves to null. Single-line
 *   text — use `Form.TextInput`.
 */
export function FormTextarea({ ref, className, ...rest }: FormTextareaProps) {
  const ctx = use(FormFieldContext)

  if (!ctx) return null
  const { field, error } = ctx

  return (
    <BaseField.Control
      render={(props) => (
        <Textarea
          {...props}
          ref={ref}
          name={field.name}
          value={(field.value as string | undefined) ?? ''}
          onChange={field.onChange}
          onBlur={field.onBlur}
          className={className}
          data-invalid={error ? true : undefined}
          data-testid={`form-${field.name}`}
          {...rest}
        />
      )}
    />
  )
}

// ---------------------------------------------------------------------------
// FormCombobox — RHF wrapper around the <Combobox> primitive
// ---------------------------------------------------------------------------

/**
 * RHF-bound option picker. Reads field state from `FormFieldContext` and
 * renders a `<Combobox density="comfortable">` wired to the field. Use
 * `multiple` for multi-select fields. Auto-derives `data-testid` and
 * forwards `data-invalid` from the field's error state.
 *
 * @when Inside a `Form.Field` for `kind: 'select'` or `'multiselect'`.
 *   Default control auto-rendered by `FormControl[select|multiselect]`
 *   via the `FormSelectControl` adapter (which resolves `optionsSource`
 *   through `useFilterOptions`). Use directly inside a custom
 *   `Form.Field` body when you need to pass static options without going
 *   through a `FormFieldSlot`.
 * @avoid Outside a `Form.Field` — the field context resolves to null.
 *   Free-form text input — use `Form.Autocomplete` (Phase 5).
 *   Toolbar / FilterBar option pickers — use the bare
 *   `<Combobox density="compact">` primitive.
 */
export function FormCombobox({ ref, className, multiple, ...rest }: FormComboboxProps) {
  const ctx = use(FormFieldContext)

  if (!ctx) return null
  const { field, error } = ctx

  const value = multiple
    ? Array.isArray(field.value)
      ? (field.value as string[])
      : []
    : ((field.value as string | null | undefined) ?? null)

  return (
    <Combobox
      ref={ref}
      multiple={multiple}
      value={value}
      onChange={(next) => field.onChange(next)}
      onBlur={field.onBlur}
      name={field.name}
      className={className}
      data-invalid={error ? true : undefined}
      data-testid={`form-${field.name}`}
      {...rest}
    />
  )
}

// ---------------------------------------------------------------------------
// FormSelect — RHF wrapper around the <Select> primitive
// ---------------------------------------------------------------------------

/**
 * RHF-bound fixed-option picker. Reads field state from `FormFieldContext`
 * and renders a `<Select density="comfortable">` wired to the field.
 * Auto-derives `data-testid` and forwards `data-invalid` from the field's
 * error state. Pass `display="value"` to render the raw value string in
 * the trigger instead of the matched option's label.
 *
 * @when Inside a `Form.Field` for short, known option lists where the
 *   user doesn't need typeahead filtering — status, role, sort order,
 *   account type. Single-select only.
 * @avoid Outside a `Form.Field` — the field context resolves to null.
 *   Long option lists or anywhere typeahead filtering helps — use
 *   `Form.Combobox`. Free-form text — use `Form.Autocomplete`. Compact
 *   toolbar / FilterBar pickers — use the bare `<Select density="compact">`
 *   primitive.
 */
export function FormSelect<T extends string | number | boolean = string>({
  ref,
  className,
  ...rest
}: FormSelectProps<T>) {
  const ctx = use(FormFieldContext)

  if (!ctx) return null
  const { field, error } = ctx

  return (
    <Select<T>
      ref={ref}
      value={(field.value as T | null | undefined) ?? null}
      onChange={(next) => field.onChange(next)}
      onBlur={field.onBlur}
      name={field.name}
      className={className}
      data-invalid={error ? true : undefined}
      data-testid={`form-${field.name}`}
      {...rest}
    />
  )
}

// ---------------------------------------------------------------------------
// FormAutocomplete — RHF wrapper around the <Autocomplete> primitive
// ---------------------------------------------------------------------------

/**
 * RHF-bound autocomplete. Reads field state from `FormFieldContext` and
 * renders an `<Autocomplete density="comfortable">` wired to the field.
 * Auto-derives `data-testid` and forwards `data-invalid` from the
 * field's error state. Free-form values entered by the user are
 * preserved on blur.
 *
 * @when Inside a `Form.Field` for `kind: 'autocomplete'`. Default
 *   control auto-rendered by `FormControl[autocomplete]` via
 *   `FormAutocompleteControl` (resolves cube-backed suggestions through
 *   `useFilterOptions`). Use directly inside a custom `Form.Field` body
 *   when you need to pass static options without going through a
 *   `FormFieldSlot`.
 * @avoid Outside a `Form.Field` — the field context resolves to null.
 *   Constrained option lists where the user must pick from the list —
 *   use `Form.Combobox`.
 */
export function FormAutocomplete({ ref, className, ...rest }: FormAutocompleteProps) {
  const ctx = use(FormFieldContext)

  if (!ctx) return null
  const { field, error } = ctx

  return (
    <Autocomplete
      ref={ref}
      value={String(field.value ?? '')}
      onChange={(next) => field.onChange(next)}
      onBlur={field.onBlur}
      name={field.name}
      className={className}
      data-invalid={error ? true : undefined}
      data-testid={`form-${field.name}`}
      {...rest}
    />
  )
}

// ---------------------------------------------------------------------------
// FormDateInput — RHF wrapper around the <DateInput> primitive
// ---------------------------------------------------------------------------

/**
 * RHF-bound single-date input. Reads field state from `FormFieldContext`
 * and renders a `<DateInput density="comfortable">` wired to the field.
 * Auto-derives `data-testid` and forwards `data-invalid` from the field's
 * error state.
 *
 * @when Inside a `Form.Field` for `kind: 'date'`. Default control
 *   auto-rendered by `FormControl[date]`.
 * @avoid Outside a `Form.Field` — the field context resolves to null.
 *   Date ranges — use `Form.DateRangeInput`. Toolbar / FilterBar date
 *   editors — use the bare `<DateInput density="compact">` primitive.
 */
export function FormDateInput({ ref, className, ...rest }: FormDateInputProps) {
  const ctx = use(FormFieldContext)

  if (!ctx) return null
  const { field, error } = ctx

  return (
    <BaseField.Control
      render={(props) => (
        <DateInput
          {...props}
          ref={ref}
          name={field.name}
          value={String(field.value ?? '')}
          onChange={field.onChange}
          onBlur={field.onBlur}
          className={className}
          data-invalid={error ? true : undefined}
          data-testid={`form-${field.name}`}
          {...rest}
        />
      )}
    />
  )
}

// ---------------------------------------------------------------------------
// FormDateRangeInput — RHF wrapper around the <DateRangeInput> primitive
// ---------------------------------------------------------------------------

/**
 * RHF-bound date range. Reads field state from `FormFieldContext` and
 * renders a `<DateRangeInput density="comfortable">` wired to the field.
 * Auto-derives `data-testid` on the wrapper; child inputs receive
 * `${testid}-from` / `${testid}-to`.
 *
 * @when Inside a `Form.Field` for `kind: 'date-range'`. Default control
 *   auto-rendered by `FormControl[date-range]`. The form's Zod schema
 *   must shape this field as `{ from?: string; to?: string }`.
 * @avoid Outside a `Form.Field` — the field context resolves to null.
 *   Single dates — use `Form.DateInput`.
 */
export function FormDateRangeInput({ ref, className, ...rest }: FormDateRangeInputProps) {
  const ctx = use(FormFieldContext)

  if (!ctx) return null
  const { field } = ctx

  return (
    <DateRangeInput
      ref={ref}
      value={(field.value as DateRangeValue | null | undefined) ?? {}}
      onChange={field.onChange}
      className={className}
      data-testid={`form-${field.name}`}
      {...rest}
    />
  )
}

// ---------------------------------------------------------------------------
// FormNumberInput — RHF wrapper around the <NumberInput> primitive
// ---------------------------------------------------------------------------

/**
 * RHF-bound number input. Reads field state from `FormFieldContext` and
 * renders a `<NumberInput density="comfortable">` wired to the field.
 * Auto-derives `data-testid` and forwards `data-invalid` from the
 * field's error state.
 *
 * @when Inside a `Form.Field` for `kind: 'number'`. Default control
 *   auto-rendered by `FormControl[number]`.
 * @avoid Outside a `Form.Field` — the field context resolves to null.
 *   Number ranges — use `Form.NumberRangeInput`. Toolbar / FilterBar
 *   number editors — use the bare `<NumberInput density="compact">`
 *   primitive.
 */
export function FormNumberInput({ ref, className, ...rest }: FormNumberInputProps) {
  const ctx = use(FormFieldContext)

  if (!ctx) return null
  const { field, error } = ctx

  return (
    <NumberInput
      ref={ref}
      value={typeof field.value === 'number' ? field.value : null}
      onChange={(next) => field.onChange(next)}
      onBlur={field.onBlur}
      name={field.name}
      className={className}
      data-invalid={error ? true : undefined}
      data-testid={`form-${field.name}`}
      {...rest}
    />
  )
}

// ---------------------------------------------------------------------------
// FormNumberRangeInput — RHF wrapper around the <NumberRangeInput> primitive
// ---------------------------------------------------------------------------

/**
 * RHF-bound number range. Reads field state from `FormFieldContext` and
 * renders a `<NumberRangeInput density="comfortable">` wired to the field.
 * Auto-derives `data-testid` on the wrapper; child inputs receive
 * `${testid}-min` / `${testid}-max`.
 *
 * @when Inside a `Form.Field` for `kind: 'number-range'`. Default
 *   control auto-rendered by `FormControl[number-range]`. The form's
 *   Zod schema must shape this field as `{ min?: number; max?: number }`.
 * @avoid Outside a `Form.Field` — the field context resolves to null.
 *   Single numbers — use `Form.NumberInput`.
 */
export function FormNumberRangeInput({ ref, className, ...rest }: FormNumberRangeInputProps) {
  const ctx = use(FormFieldContext)

  if (!ctx) return null
  const { field } = ctx

  return (
    <NumberRangeInput
      ref={ref}
      value={(field.value as NumberRangeValue | null | undefined) ?? {}}
      onChange={field.onChange}
      className={className}
      data-testid={`form-${field.name}`}
      {...rest}
    />
  )
}

// ---------------------------------------------------------------------------
// FormTagInput — RHF wrapper around the <TagInput> primitive
// ---------------------------------------------------------------------------

/**
 * RHF-bound tag input. Reads field state from `FormFieldContext` and
 * renders a `<TagInput density="comfortable">` wired to a `string[]`
 * field value. Auto-derives `data-testid={\`form-${field.name}\`}` and
 * forwards `data-invalid` from the field's error state.
 *
 * @when Inside a `Form.Field` for `kind: 'tags'`. Default control
 *   auto-rendered by `FormControl[tags]`. The form's Zod schema must
 *   shape this field as `string[]`.
 * @avoid Outside a `Form.Field` — the field context resolves to null.
 *   Constrained option lists — use `Form.Combobox` (`kind: 'multiselect'`).
 *   Display-only — use `TagList`.
 */
export function FormTagInput({ ref, className, ...rest }: FormTagInputProps) {
  const ctx = use(FormFieldContext)

  if (!ctx) return null
  const { field, error } = ctx

  return (
    <TagInput
      ref={ref}
      name={field.name}
      value={(field.value as string[] | null | undefined) ?? []}
      onChange={field.onChange}
      onBlur={field.onBlur}
      className={className}
      data-invalid={error ? true : undefined}
      data-testid={`form-${field.name}`}
      {...rest}
    />
  )
}

// ---------------------------------------------------------------------------
// FormPhoneInput — RHF wrapper around the <PhoneInput> primitive
// ---------------------------------------------------------------------------

/**
 * RHF-bound international phone input. Reads field state from
 * `FormFieldContext` and renders a `<PhoneInput>` wired to a single E.164
 * string field value. Auto-derives `data-testid={\`form-${field.name}\`}` and
 * forwards `data-invalid` from the field's error state.
 *
 * @when Inside a `Form.Field` for `kind: 'phone'`. Default control
 *   auto-rendered by `FormControl[phone]`. The form's Zod schema shapes this
 *   field as a `string` (E.164) — layer a manual `isPossiblePhoneNumber`
 *   refinement if FE gating is wanted; the backend is authoritative.
 * @avoid Outside a `Form.Field` — the field context resolves to null. A
 *   national-only field with a fixed country — use `Form.TextInput`
 *   (`type="tel"`).
 */
export function FormPhoneInput({ ref, className, ...rest }: FormPhoneInputProps) {
  const ctx = use(FormFieldContext)

  if (!ctx) return null
  const { field, error } = ctx

  return (
    <PhoneInput
      ref={ref}
      name={field.name}
      value={(field.value as string | null | undefined) ?? ''}
      onChange={(next) => field.onChange(next)}
      onBlur={field.onBlur}
      className={className}
      data-invalid={error ? true : undefined}
      data-testid={`form-${field.name}`}
      {...rest}
    />
  )
}

// ---------------------------------------------------------------------------
// FormSwitch — Base UI Switch.Root + Switch.Thumb
// ---------------------------------------------------------------------------

/**
 * Bound switch. Toggle control for boolean fields — thin RHF wrapper around
 * the `<Switch>` primitive at `#ds/ui/Switch`. The visual,
 * keyboard, and ARIA behavior live in the primitive; this wrapper supplies
 * `checked` / `onChange` / `onBlur` from `FormFieldContext` and
 * auto-derives `data-testid={\`form-${field.name}\`}`.
 *
 * @when Inside a `Form.Field` for boolean values. Default control for
 *   `kind: 'boolean'`.
 * @avoid Outside a `Form.Field` — the field context resolves to null and
 *   the component returns null. Compact-density toggles in toolbars or
 *   filter editors — use the bare `<Switch density="compact">` primitive.
 */
export function FormSwitch({ ref, className, ...rest }: FormSwitchProps) {
  const ctx = use(FormFieldContext)

  if (!ctx) return null
  const { field, error } = ctx

  return (
    <Switch
      ref={ref}
      checked={Boolean(field.value)}
      onChange={(checked) => {
        field.onChange(checked)
      }}
      onBlur={field.onBlur}
      className={className}
      data-invalid={error ? true : undefined}
      data-testid={`form-${field.name}`}
      {...rest}
    />
  )
}

// ---------------------------------------------------------------------------
// FormCheckbox — Base UI Checkbox.Root + Checkbox.Indicator
// ---------------------------------------------------------------------------

/**
 * Bound checkbox. Thin RHF wrapper around the `<Checkbox>` primitive at
 * `#ds/ui/Checkbox`. Supplies `checked` / `onChange` /
 * `onBlur` from `FormFieldContext` and auto-derives `data-testid`. The
 * `label` prop renders a trailing `<BaseField.Label>` next to the
 * checkbox — this is a Form-layer concern; the bare primitive doesn't
 * accept `label`.
 *
 * @when Inside a `Form.Field` for binary opt-in patterns ("Send invite",
 *   "I agree to terms") where a checkbox reads better than a switch.
 *   Use `label` for inline label text; omit it when the parent
 *   `Form.Field` already supplies a `Form.Label`.
 * @avoid Outside a `Form.Field` — the field context resolves to null.
 *   Compact-density checkboxes inside toolbars or option lists — use the
 *   bare `<Checkbox density="compact">` primitive directly.
 */
export function FormCheckbox({ ref, className, label, ...rest }: FormCheckboxProps) {
  const ctx = use(FormFieldContext)

  if (!ctx) return null
  const { field, error } = ctx

  const checkbox = (
    <Checkbox
      ref={ref}
      checked={Boolean(field.value)}
      onChange={(checked) => {
        field.onChange(checked)
      }}
      onBlur={field.onBlur}
      className={className}
      data-invalid={error ? true : undefined}
      data-testid={`form-${field.name}`}
      {...rest}
    />
  )

  if (!label) return checkbox

  return (
    <div className="flex items-center gap-icon">
      {checkbox}
      {/* The label toggles the checkbox (Base UI Field association), so it
          signals clickability — except when the checkbox is disabled
          (read-only rendering), where `cursor-default` matches the other
          read-only surfaces. */}
      <BaseField.Label
        className={cn('form-label', rest.disabled ? 'cursor-default' : 'cursor-pointer')}
      >
        {label}
      </BaseField.Label>
    </div>
  )
}

// ---------------------------------------------------------------------------
// FormError — Base UI Field.Error
// ---------------------------------------------------------------------------

/**
 * Field error message. Reads the current field's error from
 * `FormFieldContext` and renders Base UI's `Field.Error` styled with the
 * `form-error` text role. Renders nothing when there's no error.
 *
 * The leading `CircleAlert` glyph is the disambiguator — color alone (red
 * text) is not legible for users with red-green color blindness, so the
 * icon shape carries the error state independently of color.
 *
 * @when Inside a custom `Form.Field` body. Auto-render shapes include this.
 */
export function FormError({ ref, className, children, ...rest }: FormErrorProps) {
  const ctx = use(FormFieldContext)

  if (!ctx?.error) return null

  return (
    <BaseField.Error
      ref={ref}
      match
      className={cn('form-error inline-flex items-center gap-tight', className)}
      {...rest}
    >
      <CircleAlert className="size-icon-sm shrink-0" aria-hidden />
      <span>{children ?? ctx.error.message}</span>
    </BaseField.Error>
  )
}

// ---------------------------------------------------------------------------
// FormDescription — Base UI Field.Description
// ---------------------------------------------------------------------------

/**
 * Helper text shown beneath a control. Renders Base UI's `Field.Description`
 * styled with the `form-description` text role.
 *
 * @when Explanatory text for a single field ("When the account becomes
 *   active.").
 */
export function FormDescription({ ref, className, children, ...rest }: FormDescriptionProps) {
  const ctx = use(FormFieldContext)
  if (ctx?.error) return null
  return (
    <BaseField.Description ref={ref} className={cn('form-description', className)} {...rest}>
      {children}
    </BaseField.Description>
  )
}

// ---------------------------------------------------------------------------
// FormRootError — top-level form error (server failure, network, etc.)
// ---------------------------------------------------------------------------

/**
 * Form-level error. Subscribes to the `root` key of `formState.errors` via
 * `useFormState({ name: 'root' })` and renders it as a tinted alert banner
 * with an icon. Pair with `mapServerErrors(err, form)` from
 * `#shared/http/server-errors` — field-specific errors map to their fields;
 * everything else lands on `root`.
 *
 * Uses `useFormState` rather than reading `formState` off `useFormContext()`
 * because the latter does not reliably re-render child components when only
 * `errors.root` changes — RHF only tracks formState reads inside the
 * component that called `useForm`.
 *
 * @when Displaying server failures and other errors that don't belong to a
 *   specific field — 500s, network errors, unexpected 422 paths.
 * @avoid Using for field-level validation errors — those go on `Form.Error`
 *   inside the relevant `Form.Field`.
 */
const rootErrorVariants = cva(
  'flex items-center gap-icon rounded-interactable border px-input-x py-input-y text-body-sm text-fg',
  {
    variants: {
      // Body text is text-fg (legible on the pale tint in both themes). The
      // semantic color lives in the border + the decorative aria-hidden icon,
      // which matches its border via --alert-accent. The icon carries no
      // contrast burden (hidden from AT, redundant with role="alert" + text),
      // so it uses the vivid brand hue that would be illegible as body text.
      intent: {
        error: 'border-error bg-error/10 [--alert-accent:var(--color-error)]',
        warning: 'border-warning bg-warning/10 [--alert-accent:var(--color-warning)]',
      },
    },
    defaultVariants: { intent: 'error' },
  },
)

export function FormRootError({ className, ...rest }: ComponentPropsWithRef<'div'>) {
  const { errors } = useFormState({ name: 'root' })
  const message = errors.root?.message
  if (typeof message !== 'string' || message === '') return null
  const intent = errors.root?.type === 'warning' ? 'warning' : 'error'
  return (
    <div className={cn(rootErrorVariants({ intent }), className)} role="alert" {...rest}>
      <CircleAlert className="size-icon-lg shrink-0 text-(--alert-accent)" aria-hidden />
      <span>{message}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// FormActions — footer-shaped wrapper for submit + cancel buttons
// ---------------------------------------------------------------------------

/**
 * Right-aligned actions row. Just a flex container — components inside still
 * compose `<Form.Submit>` / `<Button>` / `<Dialog.Close>` etc. directly.
 *
 * @when The bottom of a form, holding cancel + submit (and any tertiary
 *   actions like "Save Draft").
 */
export function FormActions({ ref, className, children, ...rest }: ComponentPropsWithRef<'div'>) {
  return (
    <div ref={ref} className={cn('flex items-center justify-end gap-action', className)} {...rest}>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// FormSubmit — submit button bound to RHF state
// ---------------------------------------------------------------------------

export interface FormSubmitProps extends Omit<ComponentPropsWithRef<'button'>, 'type'> {
  /** Label while the form is submitting. Defaults to `children`. */
  pendingLabel?: ReactNode
  /** Button size. Defaults to `md`, which matches `--space-input-height`. Do not pass `sm` in a field row. */
  size?: LoadingButtonProps['size']
  /** Visual variant — `destructive` for forms whose submit deletes. Defaults to `primary`. */
  variant?: 'primary' | 'destructive'
  /**
   * Required. Format: `{feature}-{view}-{element}`.
   * Example: `accounts-create-form-submit`.
   * See `.claude/rules/concepts/testid.md` for the full spec.
   */
  'data-testid'?: string
}

/**
 * Primary submit button wired to React Hook Form's submitting state. Renders
 * a primary `LoadingButton` that auto-disables and shows a spinner (or
 * `pendingLabel` if provided) while the submission is in flight.
 *
 * Uses `useFormState` rather than reading `formState` off `useFormContext()`
 * — same reason as `Form.RootError`: the context read only stays reactive
 * while parent re-renders cascade down, and React Compiler memoization stops
 * that cascade (symptom: the button never left its pending state after a
 * cancelled pre-submit confirm). `useFormState` subscribes this component
 * directly.
 *
 * @when The default primary submit button at the bottom of a form. Pass
 *   `variant="destructive"` when the submit permanently deletes.
 * @avoid Using when you need a visual variant beyond primary/destructive —
 *   drop in `<LoadingButton type="submit" variant="…">` and read
 *   `isSubmitting` from `useFormState()` yourself.
 */
export function FormSubmit({
  ref,
  children,
  pendingLabel,
  disabled,
  size,
  variant = 'primary',
  'data-testid': testid,
  ...rest
}: FormSubmitProps) {
  const { isSubmitting } = useFormState()
  return (
    <LoadingButton
      ref={ref}
      type="submit"
      variant={variant}
      size={size}
      loading={isSubmitting}
      loadingContent={pendingLabel}
      disabled={disabled}
      data-testid={testid}
      {...rest}
    >
      {children}
    </LoadingButton>
  )
}
