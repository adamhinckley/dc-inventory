import {
  Children,
  createContext,
  isValidElement,
  use,
  type ComponentPropsWithRef,
  type ReactNode,
} from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { PII_MASK_CLASS } from '#shared/constants/pii-mask'
import { cn } from '#cn'

// ---------------------------------------------------------------------------
// Variants
// ---------------------------------------------------------------------------

const descriptionListVariants = cva('@container rounded-section flex flex-col', {
  variants: {
    variant: {
      primary: 'section',
      secondary: 'section-flat',
    },
  },
  defaultVariants: { variant: 'primary' },
})

// Caps how many columns the field grid grows to via container queries. Each
// step adds the next breakpoint, so `maxColumns` is a ceiling, not a fixed
// count — narrow containers still collapse toward a single column.
const gridVariants = cva('grid gap-x-6 gap-y-3', {
  variants: {
    maxColumns: {
      1: 'grid-cols-1',
      2: 'grid-cols-1 @lg:grid-cols-2',
      3: 'grid-cols-1 @lg:grid-cols-2 @3xl:grid-cols-3',
      4: 'grid-cols-1 @lg:grid-cols-2 @3xl:grid-cols-3 @6xl:grid-cols-4',
    },
  },
  defaultVariants: { maxColumns: 4 },
})

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/**
 * Variant convention when multiple DescriptionLists share a page:
 * - `primary` (default) — the focal resource. One per page.
 * - `secondary` — supporting / related resources rendered alongside.
 *
 * Marking every list `primary` makes them visually equivalent, which
 * defeats the hierarchy. Pick one primary, mark the rest `secondary`.
 */
export interface DescriptionListProps
  extends ComponentPropsWithRef<'div'>, VariantProps<typeof descriptionListVariants> {
  maxColumns?: number
  /**
   * The record this list is describing. When set, descendant
   * `<ResourceEntry>` descendants resolve
   * each field's value against this record automatically. Static lists
   * (using `<DescriptionList.Item>` children directly) don't need it.
   */
  record?: unknown
  /**
   * Required. Format: `{feature}-{view}-{element}`.
   * Example: `accounts-detail-summary-list`.
   * See `.claude/rules/concepts/testid.md` for the full spec.
   */
  'data-testid'?: string
}

export type DescriptionListHeadingProps = ComponentPropsWithRef<'h2'>

export interface DescriptionListItemProps extends ComponentPropsWithRef<'div'> {
  span?: number
}

export type DescriptionListTermProps = ComponentPropsWithRef<'dt'>

export interface DescriptionListDataProps extends ComponentPropsWithRef<'dd'> {
  /**
   * When true, marks the value cell for marker.io PII masking. The paired
   * `Term` is never masked — labels are not PII.
   */
  pii?: boolean
}

// ---------------------------------------------------------------------------
// Record context — exposes the active record to descendant resource-aware
// dispatchers (e.g. `ResourceEntry`).
// ---------------------------------------------------------------------------

const RecordContext = createContext<unknown>(undefined)

export function useRecord(): unknown {
  return use(RecordContext)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function splitChildren(children: ReactNode) {
  const heading: ReactNode[] = []
  const items: ReactNode[] = []
  Children.forEach(children, (child) => {
    if (isValidElement(child) && child.type === DescriptionListHeading) {
      heading.push(child)
    } else if (child != null && child !== false && child !== true && child !== '') {
      items.push(child)
    }
  })
  return { heading, items }
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

/**
 * DescriptionList container. Picks `section` (primary) or `section-flat`
 * (secondary) based on `variant`, renders a `p-card` interior, and lays out
 * children in a responsive grid.
 *
 * Variant convention when multiple lists share a page: pick exactly one
 * `primary` (focal resource) and mark the rest `secondary`. Marking every
 * list `primary` defeats the hierarchy.
 *
 * Pass `record` to expose the active record to descendant resource-aware
 * dispatchers (`ResourceEntry`); static lists using `DescriptionList.Item`
 * directly don't need it.
 *
 * @when Wrap an optional `DescriptionList.Heading` plus a series of
 *   `DescriptionList.Item` or `ResourceEntry` children.
 * @avoid Marking every list on a page `primary` — pick one focal list.
 */
export function DescriptionListRoot({
  ref,
  className,
  children,
  variant,
  maxColumns,
  record,
  ...rest
}: DescriptionListProps) {
  const { heading, items } = splitChildren(children)

  const tree = (
    <div ref={ref} className={cn(descriptionListVariants({ variant }), className)} {...rest}>
      <div className="p-card">
        {heading}
        <dl className={gridVariants({ maxColumns: maxColumns as 1 | 2 | 3 | 4 | undefined })}>
          {items}
        </dl>
      </div>
    </div>
  )

  // Only wrap in the record context when record is actually passed —
  // static lists (no record) should not pollute children with an
  // ambient null context that masks an enclosing list's record.
  if (record === undefined) return tree
  return <RecordContext value={record}>{tree}</RecordContext>
}

/**
 * Section heading. Renders an `<h2>` with the `section-content-heading` text
 * role above the grid; pulled out of children flow by `splitChildren`. `<h2>`
 * sits directly below the page `<h1>` (`PageHeader.Title`), keeping the
 * document heading order unbroken and matching a sibling `Panel.Title.Text`.
 *
 * @when Optional first child of `DescriptionList`. Identifies the resource
 *   the list describes ("Account", "License").
 */
export function DescriptionListHeading({
  ref,
  className,
  children,
  ...rest
}: DescriptionListHeadingProps) {
  return (
    <h2 ref={ref} className={cn('section-content-heading mb-3', className)} {...rest}>
      {children}
    </h2>
  )
}

/**
 * One key/value cell. Wraps a `DescriptionList.Term` + `DescriptionList.Data`
 * pair. Pass `span` to make the cell occupy multiple grid columns.
 *
 * @when Static lists where you compose the term + value yourself. For
 *   resource-driven lists, use `ResourceEntry` instead.
 */
export function DescriptionListItem({
  ref,
  className,
  children,
  span,
  ...rest
}: DescriptionListItemProps) {
  return (
    <div
      ref={ref}
      className={cn(className)}
      style={span ? { gridColumn: `span ${span}` } : undefined}
      {...rest}
    >
      {children}
    </div>
  )
}

/**
 * The "key" of a key/value pair. Renders `<dt>` styled with the
 * `section-content-label` text role.
 *
 * @when First child of a `DescriptionList.Item`.
 */
export function DescriptionListTerm({
  ref,
  className,
  children,
  ...rest
}: DescriptionListTermProps) {
  return (
    <dt ref={ref} className={cn('section-content-label mb-1', className)} {...rest}>
      {children}
    </dt>
  )
}

/**
 * The "value" of a key/value pair. Renders `<dd>` styled with the
 * `section-content-value` text role.
 *
 * @when Trailing child of a `DescriptionList.Item`, after the `Term`.
 */
export function DescriptionListData({
  ref,
  className,
  children,
  pii,
  ...rest
}: DescriptionListDataProps) {
  return (
    <dd
      ref={ref}
      className={cn('section-content-value', pii && PII_MASK_CLASS, className)}
      {...rest}
    >
      {children}
    </dd>
  )
}
