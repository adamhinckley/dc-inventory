import {
  type ClipboardEvent,
  type ComponentPropsWithRef,
  type KeyboardEvent,
  type MouseEvent,
  useRef,
  useState,
} from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Chip } from '#ds/ui/Chip'
import { PII_MASK_CLASS } from '#shared/constants/pii-mask'
import { cn } from '#cn'

const tagInputContainerVariants = cva(
  'flex w-full flex-wrap items-center gap-1 bg-surface-card text-fg transition-[border-color] cursor-text ' +
    'has-disabled:cursor-not-allowed has-disabled:opacity-60 ' +
    'focus-within:border-primary',
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

export interface TagInputProps
  extends
    Omit<ComponentPropsWithRef<'div'>, 'onChange' | 'onBlur' | 'children'>,
    VariantProps<typeof tagInputContainerVariants> {
  value: readonly string[]
  onChange: (next: string[]) => void
  onBlur?: () => void
  name?: string
  placeholder?: string
  disabled?: boolean
  'data-invalid'?: boolean
  /**
   * When true, marks the container for marker.io PII masking. Each chip
   * inherits the mask, as does the typing input.
   */
  pii?: boolean
  /**
   * Required. Format: `{feature}-{view}-{element}`.
   * Example: `organizations-edit-form-company-names-input`.
   * See `.claude/rules/concepts/testid.md` for the full spec.
   */
  'data-testid'?: string
}

const SPLIT_KEYS = new Set(['Enter', ','])

/**
 * Free-form tag input. Renders existing tags as dismissible `Chip`s alongside
 * a typing surface. Pressing Enter, typing a comma, or pasting a
 * comma-separated string adds tokens; Backspace in an empty input removes
 * the last tag; X on each chip removes that tag. Tokens are trimmed and
 * deduped silently.
 *
 * @when Editing a free-form `string[]` field in a form — company names,
 *   email aliases, hostnames, free-form labels. Wraps via `Form.Field`
 *   with `kind: 'tags'` (Form auto-renders the RHF binding).
 * @avoid Constrained option lists — use `Combobox`/`Form` with
 *   `kind: 'multiselect'`. Display-only — use `TagList`. Single tag —
 *   use a plain `Chip` or `TextInput`.
 */
export function TagInput({
  ref,
  className,
  density,
  value,
  onChange,
  onBlur,
  name,
  placeholder,
  disabled,
  pii,
  'data-invalid': dataInvalid,
  'data-testid': testId,
  ...rest
}: TagInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState('')

  const tags = value ?? []

  const commit = (raw: string): boolean => {
    const tokens = raw
      .split(',')
      .map((token) => token.trim())
      .filter((token) => token.length > 0)
    if (tokens.length === 0) return false
    const existing = new Set(tags)
    const additions: string[] = []
    for (const token of tokens) {
      if (existing.has(token)) continue
      existing.add(token)
      additions.push(token)
    }
    if (additions.length === 0) return false
    onChange([...tags, ...additions])
    return true
  }

  const removeAt = (index: number) => {
    onChange(tags.filter((_, i) => i !== index))
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (SPLIT_KEYS.has(event.key)) {
      if (draft.trim().length === 0) {
        if (event.key === 'Enter') event.preventDefault()
        return
      }
      event.preventDefault()
      if (commit(draft)) setDraft('')
      return
    }
    if (event.key === 'Backspace' && draft.length === 0 && tags.length > 0) {
      event.preventDefault()
      removeAt(tags.length - 1)
    }
  }

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData('text')
    if (!pasted.includes(',')) return
    event.preventDefault()
    if (commit(`${draft}${pasted}`)) setDraft('')
  }

  const handleBlur = () => {
    if (draft.trim().length > 0 && commit(draft)) setDraft('')
    onBlur?.()
  }

  const focusInput = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return
    inputRef.current?.focus()
  }

  return (
    <div
      ref={ref}
      className={cn(tagInputContainerVariants({ density }), pii && PII_MASK_CLASS, className)}
      data-invalid={dataInvalid ? true : undefined}
      onClick={focusInput}
      data-testid={testId}
      {...rest}
    >
      {tags.map((tag, index) => (
        <Chip key={`${tag}-${index}`} onDismiss={disabled ? undefined : () => removeAt(index)}>
          {tag}
        </Chip>
      ))}
      <input
        ref={inputRef}
        type="text"
        name={name}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onBlur={handleBlur}
        placeholder={tags.length === 0 ? placeholder : undefined}
        disabled={disabled}
        className="min-w-[8ch] flex-1 bg-transparent text-fg placeholder:text-fg-muted focus:outline-none disabled:cursor-not-allowed"
        data-testid={`${testId}-control`}
      />
    </div>
  )
}
