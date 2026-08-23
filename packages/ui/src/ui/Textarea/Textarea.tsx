import { type ComponentPropsWithRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { PII_MASK_CLASS } from '#shared/constants/pii-mask'
import { cn } from '#cn'

const textareaVariants = cva(
  'w-full bg-surface-card text-fg placeholder:text-fg-muted transition-[border-color] leading-snug disabled:cursor-not-allowed disabled:opacity-60 ' +
    'focus:border-primary focus:outline-none',
  {
    variants: {
      density: {
        comfortable:
          'rounded-interactable border border-border-field px-input-x py-input-y text-input ' +
          'hover:border-border-field-hover ' +
          'data-invalid:border-error',
        compact:
          'rounded-interactable border border-border-field hover:border-border-field-hover px-input-x-compact py-input-y-compact text-body-sm ' +
          'data-invalid:border-error',
      },
      resize: {
        none: 'resize-none',
        y: 'resize-y',
        x: 'resize-x',
        both: 'resize',
      },
    },
    defaultVariants: { density: 'comfortable', resize: 'y' },
  },
)

// `onChange` overridden with value semantics — same convention as TextInput.
export interface TextareaProps
  extends
    Omit<ComponentPropsWithRef<'textarea'>, 'onChange'>,
    VariantProps<typeof textareaVariants> {
  onChange?: (value: string) => void
  /**
   * When true, marks the textarea element for marker.io PII masking —
   * apply when the field carries long-form PII (addresses, notes about
   * a person, free-text descriptions that reference users).
   */
  pii?: boolean
  /**
   * Required. Format: `{feature}-{view}-{element}`.
   * Example: `incidents-detail-notes-input`.
   * See `.claude/rules/concepts/testid.md` for the full spec.
   */
  'data-testid'?: string
}

/**
 * Multi-line text input with density and resize variants. Plain
 * `<textarea>` under the hood — no Base UI, no hooks. Dual-renderable.
 *
 * @when Form fields that take multi-line text — descriptions, notes,
 *   long-form messages. Use via `Form.Textarea` (RHF wrapper) inside
 *   forms.
 * @avoid Single-line input — use `TextInput`. Filter contexts —
 *   `textarea` filter kind collapses to single-line `TextInput` per
 *   D5; the `Textarea` primitive isn't rendered in FilterBar. Inside
 *   a `Form.Field` — use `Form.Textarea` so RHF wiring and
 *   `data-invalid` propagation come for free.
 */
export function Textarea({
  ref,
  className,
  density,
  resize,
  rows = 3,
  onChange,
  pii,
  ...rest
}: TextareaProps) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(textareaVariants({ density, resize }), pii && PII_MASK_CLASS, className)}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      {...rest}
    />
  )
}
