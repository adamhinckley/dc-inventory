import { useId, type ComponentPropsWithRef, type ReactNode } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { CircleAlert } from 'lucide-react'
import { PII_MASK_CLASS } from '#shared/constants/pii-mask'
import { cn } from '#cn'
import { Label } from '../../primitives/label'

// Chrome lives on the wrapper `<label>` so adornments (leading / trailing
// icons) and the editable `<input>` share one bordered surface. Mirrors the
// Combobox / TagInput pattern: wrapper carries border + background +
// padding + focus state, inner input is transparent.
const wrapperVariants = cva(
  'inline-flex w-full items-center gap-icon bg-surface-card text-fg transition-[border-color] data-disabled:cursor-not-allowed data-disabled:opacity-60 ' +
    'focus-within:border-primary cursor-text',
  {
    variants: {
      density: {
        comfortable:
          'min-h-(--space-input-height) rounded-interactable border border-border-field px-input-x py-input-y text-input ' +
          'hover:border-border-field-hover ' +
          'data-invalid:border-error',
        compact:
          'rounded-interactable border border-border-field hover:border-border-field-hover px-input-x-compact py-input-y-compact text-body-sm ' +
          'data-invalid:border-error',
      },
    },
    defaultVariants: { density: 'comfortable' },
  },
)

// `onChange` overridden with value semantics per the design-system
// convention (see plan.md § Cross-phase requirements). The native
// `ChangeEvent` is mapped at the primitive boundary; callers receive
// the new string value directly.
export interface TextInputProps
  extends Omit<ComponentPropsWithRef<'input'>, 'onChange'>, VariantProps<typeof wrapperVariants> {
  onChange?: (value: string) => void
  /**
   * Hoisted to the wrapper so the `data-invalid:border-error` chrome variant
   * fires on the border the user actually sees; the same attribute is also
   * forwarded to the inner `<input>` so RHF and assistive tech observe what
   * they always have.
   */
  'data-invalid'?: boolean | 'true' | 'false'
  /**
   * When true, marks the input element for marker.io PII masking — apply
   * to fields that read or display user PII (name, email, phone, address).
   */
  pii?: boolean
  /**
   * Leading adornment (typically a `lucide-react` icon at `size-icon`).
   * Rendered before the editable input inside the same bordered chrome.
   */
  icon?: ReactNode
  /**
   * Trailing adornment. Same shape as `icon`, rendered after the input.
   * Use for non-interactive hints (key combos, units, etc.); for
   * interactive trailing controls (clear button, etc.), drop down a layer
   * and compose the wrapper manually.
   */
  iconTrailing?: ReactNode
  /**
   * Visible field label stacked above the control. Omit inside `Form.Field`
   * (`Form.Label` already owns that slot).
   */
  label?: string
  /**
   * Helper copy under the control. Hidden while `error` is set, same as
   * `Form.Description`.
   */
  helperText?: string
  /**
   * Validation message under the control. A non-empty string marks the
   * field invalid (`data-invalid` + `aria-invalid`) and replaces helper text.
   */
  error?: string
  /**
   * Required. Format: `{feature}-{view}-{element}`.
   * Example: `accounts-create-form-name-input`.
   * See `.claude/rules/concepts/testid.md` for the full spec.
   */
  'data-testid'?: string
}

/**
 * Single-line text input with a density variant for form-comfortable vs
 * filter-compact chrome. Always renders a wrapping `<label>` so an
 * optional leading / trailing icon can share the bordered surface with
 * the editable `<input>` — even when no icon is set the structure is the
 * same. Optional `label`, `helperText`, and `error` stack around that
 * chrome. `ref` points at the inner `<input>`.
 *
 * @when The default text-style control in forms (via `Form.TextInput`)
 *   and the FilterBar's text editor (`density="compact"`). Single-line
 *   non-RHF text inputs anywhere in the app — search inputs, ad-hoc
 *   forms outside the Form layer, settings panels.
 * @avoid Multi-line text — use `Textarea`. Free-form input with
 *   suggestions — use `Autocomplete`. Constrained option lists —
 *   use `Combobox`. Inside a `Form.Field` — use `Form.TextInput` so
 *   RHF wiring and `data-invalid` propagation come for free.
 */
export function TextInput({
  ref,
  className,
  density,
  type = 'text',
  onChange,
  pii,
  icon,
  iconTrailing,
  disabled,
  id: idProp,
  label,
  helperText,
  error,
  // `data-invalid` is extracted so it can be hoisted to the wrapper for the
  // border-error styling; we keep it on the input too so RHF and assistive
  // tech observe the same attribute they always have.
  'data-invalid': dataInvalid,
  ...rest
}: TextInputProps) {
  const generatedId = useId()
  const errorMessage = error && error.length > 0 ? error : undefined
  const isInvalid = Boolean(errorMessage) || dataInvalid === true || dataInvalid === 'true'
  const needsField = Boolean(label || helperText || errorMessage)
  const id = idProp ?? (needsField ? generatedId : undefined)
  const helperId = helperText && !errorMessage ? `${id}-help` : undefined
  const errorId = errorMessage ? `${id}-error` : undefined
  const describedBy =
    [rest['aria-describedby'], helperId, errorId].filter(Boolean).join(' ') || undefined

  const control = (
    <label
      className={cn(wrapperVariants({ density }), className)}
      data-invalid={isInvalid ? true : dataInvalid}
      data-disabled={disabled || undefined}
    >
      {icon ? (
        <span className="flex shrink-0 items-center text-fg-tertiary" aria-hidden>
          {icon}
        </span>
      ) : null}
      <input
        ref={ref}
        type={type}
        disabled={disabled}
        className={cn(
          'min-w-0 flex-1 bg-transparent text-fg placeholder:text-fg-muted outline-none disabled:cursor-not-allowed',
          pii && PII_MASK_CLASS,
        )}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        {...rest}
        id={id}
        data-invalid={isInvalid ? true : dataInvalid}
        aria-invalid={isInvalid || undefined}
        aria-describedby={describedBy}
      />
      {iconTrailing ? (
        <span className="flex shrink-0 items-center text-fg-tertiary" aria-hidden>
          {iconTrailing}
        </span>
      ) : null}
    </label>
  )

  if (!needsField) return control

  return (
    <div className="flex w-full flex-col gap-tight">
      {label ? <Label htmlFor={id}>{label}</Label> : null}
      {control}
      {errorMessage ? (
        <p id={errorId} role="alert" className="form-error inline-flex items-center gap-tight">
          <CircleAlert className="size-icon-sm shrink-0" aria-hidden />
          <span>{errorMessage}</span>
        </p>
      ) : helperText ? (
        <p id={helperId} className="form-description">
          {helperText}
        </p>
      ) : null}
    </div>
  )
}
