'use client'
import type { ReactNode } from 'react'
import { useFieldArray, useFormContext } from 'react-hook-form'
import { X } from 'lucide-react'
import { Button } from '#ds/ui/Button'
import { IconButton } from '#ds/ui/IconButton'

export interface RepeatableFieldsProps {
  /** RHF array path, e.g. 'addresses' */
  name: string
  /** optional section heading, rendered like a fieldset legend */
  legend?: string
  /** footer add-button label, e.g. 'Add address' */
  addLabel: string
  /**
   * Shape appended when "+ Add" is pressed. Does NOT set the initial count —
   * the cards on first render come from `defaultValues[name]` (see @example).
   */
  newItem: () => Record<string, unknown>
  /**
   * Remove is disabled at/below this count (default 0). A removal floor only —
   * it does NOT seed cards, so set `defaultValues[name]` to at least `min`.
   */
  min?: number
  /** Add is disabled at/above this count */
  max?: number
  /** renders the inputs for one item; receives its index + a name() path helper */
  children: (ctx: { index: number; name: (field: string) => string }) => ReactNode
  'data-testid'?: string
}

/**
 * Repeatable, add/remove section of fields backed by RHF's `useFieldArray`.
 * Renders a stack of item cards, a per-item Remove control (disabled at `min`),
 * and a footer "+ Add" button (disabled at `max`), via a render-prop.
 *
 * @when A form section where the user adds or removes a variable number of
 *   like-shaped field groups — names, addresses, phone numbers, emails.
 * @avoid A fixed group of related fields that never repeats — use
 *   `Form.Fieldset`. Must be rendered inside a `<Form>` (needs `FormProvider`).
 *
 * @remarks
 * The number of cards on first render is driven entirely by the form's
 * `defaultValues[name]` — `useFieldArray` seeds from there. To start with N
 * repeated sets, put N objects in `defaultValues[name]`. `newItem()` only
 * supplies the shape appended by "+ Add", and `min` only gates the Remove
 * button; neither seeds the initial count.
 *
 * @example
 * // Two address cards on first render — seed defaultValues, not a prop:
 * <Form
 *   schema={schema}
 *   defaultValues={{
 *     addresses: [
 *       { line1: '', city: '' },
 *       { line1: '', city: '' },
 *     ],
 *   }}
 *   onSubmit={onSubmit}
 *   data-testid="pii-form"
 * >
 *   <RepeatableFields name="addresses" legend="Addresses" addLabel="Add address"
 *     min={1} newItem={() => ({ line1: '', city: '' })} data-testid="pii-form-addresses">
 *     {({ name }) => (
 *       <>
 *         <Form.Field name={name('line1')} form={{ kind: 'text' }} label="Street" />
 *         <Form.Field name={name('city')} form={{ kind: 'text' }} label="City" />
 *       </>
 *     )}
 *   </RepeatableFields>
 * </Form>
 */
export function RepeatableFields({
  name,
  legend,
  addLabel,
  newItem,
  min = 0,
  max,
  children,
  'data-testid': testid,
}: RepeatableFieldsProps) {
  // `useFormContext()` is typed non-null but returns null at runtime with no
  // FormProvider — this guard is a runtime-only backstop; keep it.
  const form = useFormContext()
  if (!form) throw new Error('RepeatableFields must be rendered inside a <Form>')
  const { control } = form
  const { fields, append, remove } = useFieldArray({ control, name })

  return (
    <div className="flex flex-col gap-field" data-testid={testid}>
      {legend && <h3 className="section-content-heading">{legend}</h3>}
      {fields.map((field, index) => (
        <section
          key={field.id}
          className="relative flex flex-col rounded-section border border-border bg-surface-card-raised px-card py-3"
          data-testid={`${testid}-item-${index}`}
        >
          <IconButton
            className="absolute right-1 top-1 size-6"
            variant="subtle"
            shape="square"
            size="sm"
            icon={<X className="text-fg" strokeWidth={3} />}
            aria-label={`Remove ${legend ?? 'item'} ${index + 1}`}
            disabled={fields.length <= min}
            onClick={() => remove(index)}
            data-testid={`${testid}-remove-${index}`}
          />
          <div className="flex flex-col gap-field">
            {children({ index, name: (path) => `${name}.${index}.${path}` })}
          </div>
        </section>
      ))}
      <Button
        variant="ghost"
        size="sm"
        disabled={max != null && fields.length >= max}
        onClick={() => append(newItem())}
        data-testid={`${testid}-add`}
      >
        + {addLabel}
      </Button>
    </div>
  )
}
