import type { ComponentPropsWithRef } from 'react'
import { cn } from '#cn'

export type FieldRowProps = ComponentPropsWithRef<'div'>

/**
 * Horizontal group of labeled fields plus a trailing action.
 *
 * `items-end` lines the controls up (not the labels). Gap is `gap-field-group`.
 * Put each label+control in `LabeledField`. Put the row action in a `primary`
 * Button at default `md` size (same height as Input).
 *
 * @when Vendor + product + qty + "Add line". Filter rows with a submit.
 * @avoid `items-center` (aligns to labels). `size="sm"` on the row button.
 */
export function FieldRow({ ref, className, ...rest }: FieldRowProps) {
  return (
    <div
      ref={ref}
      className={cn('flex flex-wrap items-end gap-field-group', className)}
      {...rest}
    />
  )
}

export type LabeledFieldProps = ComponentPropsWithRef<'div'>

/**
 * Label stacked on a control with `gap-field`.
 *
 * @when Any labeled Input, Select, Combobox, or similar outside `Form.Field`.
 */
export function LabeledField({ ref, className, ...rest }: LabeledFieldProps) {
  return <div ref={ref} className={cn('flex flex-col gap-field', className)} {...rest} />
}
