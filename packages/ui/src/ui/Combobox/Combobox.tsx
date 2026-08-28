'use client'

import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type RefObject,
} from 'react'
import { useVirtualizer, type Virtualizer } from '@tanstack/react-virtual'
import { Combobox as BaseCombobox } from '@base-ui-components/react/combobox'
import { Check, ChevronDown, X } from 'lucide-react'
import { cva, type VariantProps } from 'class-variance-authority'
import { PII_MASK_CLASS } from '#shared/constants/pii-mask'
import { cn } from '#cn'
import type { Option } from '#shared/resource/types'

// Chrome (border, padding, focus ring) lives on the wrapper. Typography
// goes on the Combobox.Input element below — content-typography-on-content
// per the design-tokens rule.
// `flex-wrap` lets chips and the input flow on the same row when there's
// space; the input wraps to the next line when chips fill the row. Chips
// use `display: contents` to flatten into siblings of the input below.
const inputGroupVariants = cva(
  'flex w-full flex-wrap items-center gap-tight bg-surface-card transition-[border-color] data-disabled:cursor-not-allowed data-disabled:opacity-60 ' +
    'focus-within:border-primary',
  {
    variants: {
      density: {
        comfortable:
          'min-h-(--space-input-height) rounded-interactable border border-border-field px-input-x py-input-y ' +
          'hover:border-border-field-hover ' +
          'data-invalid:border-error',
        compact:
          'rounded-interactable border border-border-field hover:border-border-field-hover px-input-x-compact py-input-y-compact ' +
          'data-invalid:border-error',
      },
    },
    defaultVariants: { density: 'comfortable' },
  },
)

// Option-row chrome shared by the plain and virtualized list renderers —
// the two paths must stay visually identical.
const optionItemClass =
  'stacked interactable ghost item-padding flex items-center justify-between gap-icon text-xs data-highlighted:bg-interactive-strong data-selected:font-medium'

const inputVariants = cva(
  'min-h-0 min-w-0 flex-1 bg-transparent outline-none text-fg placeholder:text-fg-muted disabled:cursor-not-allowed',
  {
    variants: {
      density: {
        comfortable: 'text-input',
        compact: 'text-body-sm',
      },
    },
    defaultVariants: { density: 'comfortable' },
  },
)

// Native <button> UA padding is what made Combobox taller than Input.
// size-6 is a 24px hit target (WCAG 2.5.8). -my-0.5 offsets the 4px that
// would otherwise grow the padded 38px control (inner content is 20px).
const chromeButtonClass =
  'inline-flex size-6 shrink-0 items-center justify-center border-0 bg-transparent p-0 -my-0.5 text-fg-tertiary hover:text-fg transition-colors'

// Async resolver hook — runs the async loader on mount, tracks internal
// loading state, surfaces resolved options. For static arrays, returns
// the array as-is. The resource-system dispatchers don't use this path —
// they pre-resolve via `useFilterOptions` and pass `{options, loading}`
// directly. This path serves callers using the primitive standalone.
function useResolvedOptions(source: Option[] | (() => Promise<Option[]>)): {
  resolved: Option[]
  internalLoading: boolean
} {
  const isStatic = Array.isArray(source)
  const [resolved, setResolved] = useState<Option[]>(isStatic ? source : [])
  const [internalLoading, setInternalLoading] = useState(false)

  useEffect(() => {
    if (isStatic) return
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInternalLoading(true)
    source()
      .then((result) => {
        if (!cancelled) setResolved(result)
      })
      .catch(() => {
        if (!cancelled) setResolved([])
      })
      .finally(() => {
        if (!cancelled) setInternalLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [source, isStatic])

  return { resolved: isStatic ? source : resolved, internalLoading }
}

// Props extend `'input'` because the primary interactable in the rendered
// DOM is the trigger / typing `<input>` (Base UI's `Combobox.Input`).
// `ref` and caller-supplied `aria-*` / `id` / `autoComplete` / `name`
// flow to that input. `className` is the exception — it lands on the
// outer InputGroup wrapper so caller styling can adjust the chrome.
//
// `onChange` is a value-change callback per the design-system convention
// — receives the new value directly, not a `ChangeEvent`. Single mode:
// `(value: string | null) => void`. Multi mode: `(value: string[]) => void`.
export interface ComboboxProps
  extends
    Omit<ComponentPropsWithRef<'input'>, 'value' | 'onChange' | 'name' | 'type' | 'list'>,
    VariantProps<typeof inputGroupVariants> {
  /**
   * Static options array OR an async loader run once on mount. Cube-backed
   * options resolve in the resource-system dispatchers via
   * `useFilterOptions`; this primitive doesn't know about `OptionsSource`.
   *
   * Server-driven typeahead (each keystroke fires a query) is not yet
   * supported.
   */
  options: Option[] | (() => Promise<Option[]>)
  /**
   * External loading state. OR'd with the primitive's internal loading
   * state when `options` is an async function. Used by the resource-system
   * dispatchers passing `useFilterOptions`'s `loading` flag through.
   */
  loading?: boolean

  value: string | string[] | null
  onChange: (next: string | string[] | null) => void
  multiple?: boolean

  /**
   * Virtualize the popup list with `@tanstack/react-virtual` — every
   * (filtered) option stays reachable by scrolling while only the visible
   * window is mounted. Use for large option sets (hundreds+). The wrapper
   * supplies Base UI's own collator filter explicitly so keyboard
   * navigation and the virtualizer walk one identical filtered list.
   *
   * Verified for single-select only — the `multiple` chips flow has no
   * virtualized consumer or story yet; verify before combining.
   */
  virtualize?: boolean
  /** Optional override of the auto-derived form/filter name. */
  name?: string
  /** Show a clear button when the input has a value. */
  clearable?: boolean
  /** Placeholder for the input. */
  placeholder?: string
  /** Standard `data-testid`. Lands on the input; options derive `${testid}-option-${value}`. */
  'data-testid'?: string
  /** Marks the input group as invalid; lands on the wrapper div so the
   *  `data-invalid:border-error` CVA variant fires. Form.Combobox forwards
   *  this from RHF's field error state automatically. */
  'data-invalid'?: boolean
  /**
   * When true, marks the chrome and popup for marker.io PII masking — apply
   * when the option labels are user data (account names, person names,
   * emails). The dropdown list and the selected-value display both
   * inherit the mask.
   */
  pii?: boolean
}

/**
 * Combobox primitive backed by Base UI's Combobox. Typeahead-filterable
 * option picker; single or multi mode; static, async, or external-state
 * options; density variant for form vs filter chrome.
 *
 * @when Picking from a list where typeahead filtering matters — long
 *   option lists, FilterBar select / multiselect editors, cube-backed
 *   dimension pickers (resolved through the resource-system dispatchers).
 *   Inside a `<Form>`, prefer `Form.Combobox` (RHF wrapper that
 *   auto-wires `data-invalid`).
 * @avoid Short fixed option lists where typeahead isn't needed (status,
 *   role, sort order) — use `Select`. Boolean / on-off values — use
 *   `Select` for a dropdown UX, or `Switch` / `Checkbox` for an inline
 *   toggle. Free-form text with optional suggestions — use `Autocomplete`.
 *   Server-driven typeahead (each keystroke fires a query) — not yet
 *   supported; surface as a follow-up.
 */
export function Combobox({
  options,
  loading: externalLoading,
  value,
  onChange,
  multiple = false,
  placeholder,
  density,
  clearable = false,
  virtualize = false,
  disabled,
  className,
  ref,
  name,
  onBlur,
  pii,
  'data-testid': testid,
  'data-invalid': dataInvalid,
  ...rest
}: ComboboxProps) {
  const { resolved, internalLoading } = useResolvedOptions(options)
  const loading = Boolean(externalLoading) || internalLoading
  // Anchor the popup to the wrapping InputGroup div (not the inner
  // <input>) so the popup aligns with the chrome edges and
  // `--anchor-width` matches the InputGroup's full width.
  const groupRef = useRef<HTMLDivElement>(null)

  // Map string value(s) ↔ Option object(s) so Base UI can render the
  // selected option's `label` in the input. Base UI auto-detects the
  // `{value, label}` shape: `.label` is used as the input display text,
  // `.value` is used for form submission.
  const baseValue = multiple
    ? Array.isArray(value)
      ? (value.map((v) => resolved.find((o) => o.value === v)).filter(Boolean) as Option[])
      : []
    : value != null && !Array.isArray(value)
      ? (resolved.find((o) => o.value === value) ?? null)
      : null
  const isItemEqualToValue = (a: Option, b: Option) => a.value === b.value

  // Virtualized mode (the `virtualize` prop): Base UI's `virtualized` flag
  // hands list rendering to us, so the wrapper owns the open + query state,
  // computes the filtered list, and mounts only the visible window
  // (`ComboboxVirtualList`). The filter is Base UI's own collator filter
  // (`useFilter` mirrors the internal default, including "show everything
  // while the input still equals the selected label") — supplied explicitly
  // as the `filter` prop so Base UI's keyboard-navigation indices and our
  // virtualizer walk one identical list.
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const virtualizerRef = useRef<Virtualizer<HTMLDivElement, Element> | null>(null)
  const collator = BaseCombobox.useFilter({
    multiple,
    value: multiple ? undefined : (baseValue as Option | null),
  })
  const filterFn = (item: Option, q: string) => collator.contains(item, q, (o: Option) => o.label)
  const virtualItems = virtualize ? resolved.filter((o) => filterFn(o, query.trim())) : resolved

  return (
    <BaseCombobox.Root
      items={resolved}
      itemToStringValue={(item: Option) => item.value}
      itemToStringLabel={(item: Option) => item.label}
      isItemEqualToValue={isItemEqualToValue as never}
      value={baseValue as never}
      onValueChange={(next: Option | Option[] | null) => {
        if (multiple) {
          onChange(Array.isArray(next) ? next.map((o) => o.value) : [])
        } else {
          onChange(next && !Array.isArray(next) ? next.value : null)
        }
      }}
      multiple={multiple as never}
      disabled={disabled}
      {...(virtualize
        ? {
            virtualized: true,
            open,
            onOpenChange: setOpen,
            onInputValueChange: (next: string) => {
              setQuery(next)
            },
            filter: filterFn as never,
            // Keyboard navigation across unmounted rows: mirror Base UI's
            // virtualized demo — scroll on programmatic highlights and on
            // keyboard wrap-around (Home/End/loop edges).
            onItemHighlighted: (
              _item: Option | undefined,
              details: { reason: string; index: number },
            ) => {
              const virtualizer = virtualizerRef.current
              if (!virtualizer || details.index < 0) return
              const isStart = details.index === 0
              const isEnd = details.index === virtualizer.options.count - 1
              if (
                details.reason === 'none' ||
                (details.reason === 'keyboard' && (isStart || isEnd))
              ) {
                queueMicrotask(() => {
                  virtualizer.scrollToIndex(details.index, { align: isEnd ? 'start' : 'end' })
                })
              }
            },
          }
        : {})}
    >
      <div
        ref={groupRef}
        className={cn(inputGroupVariants({ density }), pii && PII_MASK_CLASS, className)}
        data-invalid={dataInvalid}
        data-disabled={disabled || undefined}
      >
        {multiple && Array.isArray(value) && value.length > 0 && (
          // `display: contents` flattens the Chips wrapper into the input
          // group's flex flow so chips wrap inline with the input.
          <BaseCombobox.Chips className="contents">
            {value.map((v) => {
              const opt = resolved.find((o) => o.value === v)
              const label = opt?.label ?? v
              return (
                <BaseCombobox.Chip
                  key={v}
                  className="inline-flex items-center gap-tight rounded-sm bg-interactive-strong px-1.5 py-0.5 text-xs text-fg"
                >
                  {label}
                  <BaseCombobox.ChipRemove
                    className="text-fg-tertiary hover:text-fg transition-colors"
                    aria-label={`Remove ${label}`}
                  >
                    <X className="size-icon-sm" />
                  </BaseCombobox.ChipRemove>
                </BaseCombobox.Chip>
              )
            })}
          </BaseCombobox.Chips>
        )}
        <BaseCombobox.Input
          ref={ref as never}
          name={name}
          placeholder={placeholder}
          onBlur={onBlur}
          className={inputVariants({ density })}
          data-testid={testid}
          {...(rest as Record<string, unknown>)}
        />
        {clearable && (
          <BaseCombobox.Clear className={chromeButtonClass}>
            <X className="size-icon" />
          </BaseCombobox.Clear>
        )}
        <BaseCombobox.Trigger className={chromeButtonClass}>
          <BaseCombobox.Icon>
            <ChevronDown className="size-icon" />
          </BaseCombobox.Icon>
        </BaseCombobox.Trigger>
      </div>
      <BaseCombobox.Portal>
        <BaseCombobox.Positioner
          anchor={groupRef}
          className="z-popover"
          side="bottom"
          align="start"
          sideOffset={4}
        >
          <BaseCombobox.Popup
            className={cn(
              'overlay rounded-interactable shadow-overlay min-w-(--anchor-width)',
              // Virtualized mode scrolls inside ComboboxVirtualList — a
              // second scrollport here would break the virtualizer's math.
              !virtualize && 'max-h-72 overflow-auto',
              pii && PII_MASK_CLASS,
            )}
          >
            {loading ? (
              <div className="item-padding text-xs text-fg-tertiary">Loading...</div>
            ) : (virtualize ? virtualItems : resolved).length === 0 ? (
              <div className="item-padding text-xs text-fg-tertiary">No options</div>
            ) : virtualize ? (
              <BaseCombobox.List>
                <ComboboxVirtualList
                  items={virtualItems}
                  open={open}
                  virtualizerRef={virtualizerRef}
                  data-testid={testid}
                />
              </BaseCombobox.List>
            ) : (
              <BaseCombobox.List>
                {(item: Option) => (
                  <BaseCombobox.Item
                    key={item.value}
                    value={item}
                    className={optionItemClass}
                    data-testid={testid ? `${testid}-option-${item.value}` : undefined}
                  >
                    <span>{item.label}</span>
                    <BaseCombobox.ItemIndicator className="text-primary">
                      <Check className="size-icon" strokeWidth={3} />
                    </BaseCombobox.ItemIndicator>
                  </BaseCombobox.Item>
                )}
              </BaseCombobox.List>
            )}
          </BaseCombobox.Popup>
        </BaseCombobox.Positioner>
      </BaseCombobox.Portal>
    </BaseCombobox.Root>
  )
}

interface ComboboxVirtualListProps {
  /** The FILTERED options — must be the same list Base UI's indices track. */
  items: Option[]
  /** Popup open state — the virtualizer only runs while open. */
  open: boolean
  /** Receives the live virtualizer so Root's `onItemHighlighted` can scroll. */
  virtualizerRef: RefObject<Virtualizer<HTMLDivElement, Element> | null>
  'data-testid'?: string
}

/**
 * Virtualized popup list body (the `virtualize` prop). Owns the popup's
 * scrollport; only the visible window of rows is mounted, absolutely
 * positioned inside a spacer sized to the full list, so thousands of
 * options stay scrollable without their DOM cost.
 *
 * @when Rendered internally by `Combobox` when `virtualize` is set — never
 *   composed directly by consumers.
 * @avoid Adding a second scroll container around it (the Popup must not
 *   scroll in virtualized mode) — the virtualizer measures THIS element.
 */
function ComboboxVirtualList({
  items,
  open,
  virtualizerRef,
  'data-testid': testid,
}: ComboboxVirtualListProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  // Run-once guard for the mount-time measure() below. The React Compiler
  // skips memoizing this component (useVirtualizer is on its incompatible
  // list), so the inline ref callback gets a NEW identity every render and
  // React re-invokes it each time — an unguarded measure() re-renders and
  // loops ("Maximum update depth exceeded").
  const measuredRef = useRef(false)
  const virtualizer = useVirtualizer({
    enabled: open,
    count: items.length,
    getScrollElement: () => scrollRef.current,
    // item-padding rows with text-xs measure ~24px; measureElement corrects.
    estimateSize: () => 24,
    overscan: 20,
    paddingStart: 4,
    paddingEnd: 4,
    scrollPaddingStart: 4,
    scrollPaddingEnd: 4,
  })
  useImperativeHandle(virtualizerRef, () => virtualizer)
  const totalSize = virtualizer.getTotalSize()

  return (
    <div
      role="presentation"
      ref={(node) => {
        scrollRef.current = node
        // Re-measure once when the scroll element first exists — the
        // virtualizer is created before the popup content mounts.
        if (node && !measuredRef.current) {
          measuredRef.current = true
          virtualizer.measure()
        }
      }}
      // Firefox puts scroll containers in the tab order by default —
      // layout scrollports opt out (accessibility.md); items own focus.
      tabIndex={-1}
      className="max-h-72 overflow-auto overscroll-contain focus:outline-none"
    >
      <div role="presentation" className="relative w-full" style={{ height: totalSize }}>
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const item = items[virtualItem.index]
          if (!item) return null
          return (
            <BaseCombobox.Item
              key={virtualItem.key}
              index={virtualItem.index}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              value={item}
              aria-setsize={items.length}
              aria-posinset={virtualItem.index + 1}
              className={cn(optionItemClass, 'absolute top-0 left-0 w-full')}
              style={{ height: virtualItem.size, transform: `translateY(${virtualItem.start}px)` }}
              data-testid={testid ? `${testid}-option-${item.value}` : undefined}
            >
              <span>{item.label}</span>
              <BaseCombobox.ItemIndicator className="text-primary">
                <Check className="size-icon" strokeWidth={3} />
              </BaseCombobox.ItemIndicator>
            </BaseCombobox.Item>
          )
        })}
      </div>
    </div>
  )
}
