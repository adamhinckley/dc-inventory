import {
  Children,
  createContext,
  Fragment,
  isValidElement,
  use,
  useState,
  type ComponentPropsWithRef,
  type ReactNode,
} from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Pencil } from 'lucide-react'
import { cn } from '#cn'
import { Button, type ButtonProps } from '#ds/ui/Button'
import { Dialog } from '#ds/ui/Dialog'
import { DescriptionList } from '#ds/ui/DescriptionList'
import { PageHeader } from '#ds/ui/PageHeader'
import { Skeleton } from '#ds/ui/Skeleton'

// ---------------------------------------------------------------------------
// Variants
// ---------------------------------------------------------------------------

/**
 * Summary-row child sizing. The base gives every direct child an equal share
 * with a 300px floor — below that the row wraps rather than squeezing. `columns`
 * only decides whether the first child gets a double share, and it's a variant
 * rather than something a child overrides because `[&>*]:` utilities tie on
 * specificity with a plain class on a child (emit order would pick the winner).
 *
 * Kept in the `[&>…]` arbitrary-variant form, not v4's shorter `*:` / `*:first:`
 * sugar: nothing else in the app uses `*:` yet, and an arbitrary variant that
 * fails to compile emits NOTHING silently — here that would drop the 2:1
 * weighting on all seven other detail pages. These exact strings ship today.
 */
const summaryVariants = cva(
  'flex flex-wrap items-stretch gap-3 [&>*]:flex-1 [&>*]:min-w-[300px] shrink-0',
  {
    variants: {
      columns: {
        weighted: '[&>:first-child]:flex-[2]',
        equal: '',
      },
    },
    defaultVariants: { columns: 'weighted' },
  },
)

function DetailViewSummarySkeleton({ itemCount = 6 }: { itemCount?: number }) {
  return (
    <DescriptionList data-testid="detail-view-skeleton-summary-list">
      <DescriptionList.Heading>
        <Skeleton className="h-4 w-32" />
      </DescriptionList.Heading>
      {Array.from({ length: itemCount }, (_, i) => (
        <DescriptionList.Item key={i}>
          <DescriptionList.Term>
            <Skeleton className="h-3 w-20" />
          </DescriptionList.Term>
          <DescriptionList.Data>
            <Skeleton className="h-4 w-40" />
          </DescriptionList.Data>
        </DescriptionList.Item>
      ))}
    </DescriptionList>
  )
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface DetailViewContextValue {
  editOpen: boolean
  setEditOpen: (open: boolean) => void
  hasEditDialog: boolean
}

const DetailViewContext = createContext<DetailViewContextValue | null>(null)

export function useDetailView() {
  const ctx = use(DetailViewContext)
  if (!ctx) throw new Error('useDetailView must be used within a DetailView')
  return ctx
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DetailViewProps<T = unknown> extends Omit<
  ComponentPropsWithRef<'div'>,
  'children'
> {
  /**
   * When true, renders a centered Spinner instead of any children.
   */
  loading?: boolean
  /**
   * Query error, if any. When set, renders an error state — never silently
   * blanks the page. Typed as `unknown` because TanStack Query exposes the
   * underlying fetch error (which Orval types as the response body shape,
   * not always a real `Error`); message is extracted defensively.
   */
  error?: unknown
  /**
   * Resource data. When provided, `children` must be a function that receives
   * the (non-null) data with TS narrowing. When `data` is null/undefined and
   * neither `loading` nor `error` is set, the view renders a "not found"
   * state — never silently blanks.
   */
  data?: T | null | undefined
  /**
   * Static JSX (no `data` prop) OR a render function `(data) => ReactNode`
   * that receives the loaded data. Function form pairs with the `data` prop.
   */
  children: ReactNode | ((data: NonNullable<T>) => ReactNode)
  /**
   * Edit-dialog config passed as a prop instead of a `<DetailView.EditDialog>`
   * child. When supplied (non-null), it WINS over children-based detection —
   * the mechanism a **server** parent uses to compose a permission/flag-gated
   * edit affordance across the RSC boundary (children identity-detection breaks
   * across that boundary because a client-reference proxy's `type` is not the
   * original component). A server layout computes `canEdit` server-side and
   * passes the config (or `null` to fall back to detection / render nothing).
   * Omit it entirely and existing children-based consumers are unaffected.
   */
  editDialog?: DetailViewEditDialogProps | null
}

export type DetailViewHeaderProps = ComponentPropsWithRef<'div'>

export interface DetailViewSummaryProps
  extends ComponentPropsWithRef<'div'>, VariantProps<typeof summaryVariants> {}

export type DetailViewTabsProps = ComponentPropsWithRef<'div'>

export interface DetailViewEditDialogProps {
  title: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  children: ReactNode
  /**
   * Required. Format: `{feature}-{view}-{element}`.
   * Example: `accounts-edit-form-dialog`.
   * See `.claude/rules/concepts/testid.md` for the full spec.
   */
  'data-testid'?: string
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Pull a user-facing message out of an unknown error value. TanStack
 * Query's `error` is typed as the underlying fetch's TError — for Orval
 * that's the response body shape (e.g. `HTTPValidationError` with
 * `detail: ValidationError[]`), not always a `Error`. Walk a few common
 * shapes and fall back to a generic message.
 */
function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (typeof error === 'object' && error !== null) {
    if ('message' in error && typeof (error as { message: unknown }).message === 'string') {
      return (error as { message: string }).message
    }
    if ('detail' in error) {
      const detail = (error as { detail: unknown }).detail
      if (typeof detail === 'string') return detail
      if (Array.isArray(detail) && detail[0] && typeof detail[0] === 'object') {
        const first = detail[0] as { msg?: string; message?: string }
        if (typeof first.msg === 'string') return first.msg
        if (typeof first.message === 'string') return first.message
      }
    }
  }
  return 'An unexpected error occurred.'
}

interface SplitResult {
  header: ReactNode
  summary: ReactNode
  tabs: ReactNode
  editDialogProps: DetailViewEditDialogProps | null
}

function splitChildren(children: ReactNode): SplitResult {
  const result: SplitResult = { header: null, summary: null, tabs: null, editDialogProps: null }
  walkSplit(children, result)
  return result
}

/**
 * Walk children to find typed sub-components, recursing through fragments.
 * `Children.forEach` treats a `<>...</>` as a single element, so render-prop
 * consumers (`{(data) => <>...</>}`) would have their slots invisible
 * without this. Recurse only one level to avoid surprising behavior.
 */
function walkSplit(children: ReactNode, result: SplitResult): void {
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return
    if (child.type === Fragment) {
      walkSplit((child.props as { children?: ReactNode }).children, result)
      return
    }
    if (child.type === DetailViewHeader) result.header = child
    else if (child.type === DetailViewSummary) result.summary = child
    else if (child.type === DetailViewTabs) result.tabs = child
    else if (child.type === DetailViewEditDialog) {
      result.editDialogProps = child.props as DetailViewEditDialogProps
    }
  })
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/**
 * Top-level header region for the detail view. Renders above the scrollable
 * content area with a bottom border separator.
 *
 * @when Page titles, breadcrumbs, action bars with DetailView.EditButton.
 * @tokens border-border (bottom divider), px-canvas py-region-y (padding)
 */
export function DetailViewHeader({ children, className, ref, ...rest }: DetailViewHeaderProps) {
  return (
    <div ref={ref} className={cn('flex-shrink-0 px-canvas py-region-y', className)} {...rest}>
      {children}
    </div>
  )
}

/**
 * Summary region that renders children (typically DescriptionList components)
 * in a responsive flex row. Every direct child is `flex-1` with a 300px floor,
 * so the row wraps once the floors can't share a line.
 *
 * @when Displaying key-value metadata about the entity being viewed.
 * @avoid Overriding the child sizing with a class on a CHILD — the rules here
 *   are `[&>*]:` variant utilities, which tie on specificity with a plain class
 *   on a child, so the winner would come down to Tailwind's emit order. Use the
 *   `columns` prop, or pass a higher-specificity `[&>:last-child]:` /
 *   `[&>:first-child]:` class to THIS element (`.summary > :last-child` is one
 *   level above `.summary > *`, so it wins outright).
 * @param columns `weighted` (default) doubles the first child — the common
 *   "primary panel + sidecar" split. `equal` gives every child the same width.
 * @tokens gap-3 (child spacing)
 */
export function DetailViewSummary({
  children,
  className,
  columns,
  ref,
  ...rest
}: DetailViewSummaryProps) {
  return (
    <div ref={ref} className={cn(summaryVariants({ columns }), className)} {...rest}>
      {children}
    </div>
  )
}

/**
 * Tabs region within the scrollable content area. The Tabs component provides
 * its own styling so this wrapper applies no layout classes in the normal
 * (scrolling-body) case. When the active tab contains a sticky table it becomes
 * a `flex-1 min-h-0` column so the definite-height chain reaches the card
 * (CORE-1009); inert otherwise.
 *
 * @when Switching between related data views for the entity.
 */
export function DetailViewTabs({ children, className, ref, ...rest }: DetailViewTabsProps) {
  return (
    <div
      ref={ref}
      className={cn(
        'has-data-sticky-table:flex has-data-sticky-table:min-h-0 has-data-sticky-table:flex-1 has-data-sticky-table:flex-col',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
}

/**
 * Marker component for the edit dialog. Returns null — the root component
 * extracts its props and renders the Dialog in a portal.
 *
 * @when Providing an inline edit form for the entity being viewed.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function DetailViewEditDialog(_props: DetailViewEditDialogProps) {
  return null
}

export interface DetailViewEditButtonProps
  extends Omit<ComponentPropsWithRef<'button'>, 'type'>, Pick<ButtonProps, 'variant' | 'size'> {
  /**
   * Required. Format: `{feature}-{view}-{element}`.
   * Example: `accounts-detail-edit-trigger`.
   * See `.claude/rules/concepts/testid.md` for the full spec.
   */
  'data-testid'?: string
}

/**
 * Renders an Edit button that opens the DetailView's edit dialog. Only visible
 * when a DetailView.EditDialog is present. Place inside PageHeader.Actions or
 * similar action containers.
 *
 * Defaults to `variant="primary"` and `size="sm"`. Consumers can override
 * either by passing a different value — e.g., `<DetailView.EditButton
 * variant="ghost" />` for a quieter affordance.
 *
 * @when Adding edit capability to a detail page's header actions.
 */
export function DetailViewEditButton({
  className,
  ref,
  variant = 'primary',
  size = 'sm',
  'data-testid': testid,
  ...rest
}: DetailViewEditButtonProps) {
  const ctx = use(DetailViewContext)
  if (!ctx?.hasEditDialog) return null
  return (
    <Button
      ref={ref}
      variant={variant}
      size={size}
      className={className}
      onClick={() => ctx.setEditOpen(true)}
      data-testid={testid}
      tabIndex={0}
      {...rest}
    >
      <Pencil className="size-icon-lg" />
      Edit
    </Button>
  )
}

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

/**
 * Root layout component for entity detail pages. Structures content into
 * Header, Summary, Tabs, and an optional EditDialog. Renders children by
 * type — place sub-components in any order and they slot into the correct
 * position.
 *
 * @when Building detail/show pages for a single entity with metadata summary,
 *   tabbed content, and optional inline editing.
 * @avoid Using for list/explorer pages — use ExplorerView instead.
 */
export function DetailViewRoot<T = unknown>({
  loading,
  error,
  data,
  children,
  editDialog,
  className,
  ref,
  ...rest
}: DetailViewProps<T>) {
  // Loading state — render the chrome with skeleton placeholders so the
  // page keeps the same shape it will have once data lands. The summary
  // doesn't know the field shape here; default to a 6-row description list.
  if (loading) {
    return (
      <DetailViewLayout className={className} ref={ref} {...rest}>
        <DetailViewHeader>
          <PageHeader data-testid="detail-view-skeleton-page-header">
            <PageHeader.HeaderRow>
              <PageHeader.Content>
                <PageHeader.Title isPending />
                <PageHeader.Subtitle isPending />
              </PageHeader.Content>
            </PageHeader.HeaderRow>
          </PageHeader>
        </DetailViewHeader>
        <DetailViewSummary>
          <DetailViewSummarySkeleton itemCount={6} />
        </DetailViewSummary>
      </DetailViewLayout>
    )
  }

  // Error state — surface failures so the page never silently blanks.
  if (error) {
    return (
      <div
        ref={ref}
        className={cn(
          'flex h-full flex-col items-center justify-center gap-icon p-canvas',
          className,
        )}
        {...rest}
      >
        <p className="text-fg">Failed to load.</p>
        <p className="text-body-sm text-fg-secondary">{extractErrorMessage(error)}</p>
      </div>
    )
  }

  // Render-prop form: children is a function, data must be non-null to render.
  if (typeof children === 'function') {
    // Data missing post-load (404, deleted, scope mismatch). Show a "not
    // found" state instead of blanking — the user can navigate back.
    if (data == null) {
      return (
        <div
          ref={ref}
          className={cn(
            'flex h-full flex-col items-center justify-center gap-icon p-canvas',
            className,
          )}
          {...rest}
        >
          <p className="text-fg">Not found.</p>
          <p className="text-body-sm text-fg-secondary">
            This resource doesn't exist or you don't have access to it.
          </p>
        </div>
      )
    }
    return (
      <DetailViewLayout editDialog={editDialog} className={className} ref={ref} {...rest}>
        {children(data as NonNullable<T>)}
      </DetailViewLayout>
    )
  }

  // Static form: children is JSX, render directly.
  return (
    <DetailViewLayout editDialog={editDialog} className={className} ref={ref} {...rest}>
      {children}
    </DetailViewLayout>
  )
}

interface DetailViewLayoutProps extends ComponentPropsWithRef<'div'> {
  children: ReactNode
  editDialog?: DetailViewEditDialogProps | null
}

function DetailViewLayout({
  children,
  editDialog,
  className,
  ref,
  ...rest
}: DetailViewLayoutProps) {
  const {
    header,
    summary,
    tabs,
    editDialogProps: detectedEditDialogProps,
  } = splitChildren(children)
  // Explicit prop wins over children identity-detection (which breaks across
  // the RSC boundary). Omitted prop → fall back to the detected child slot.
  const editDialogProps = editDialog ?? detectedEditDialogProps
  const [editOpen, setEditOpen] = useState(false)
  const hasEditDialog = editDialogProps !== null

  return (
    <DetailViewContext value={{ editOpen, setEditOpen, hasEditDialog }}>
      <div ref={ref} className={cn('flex h-full flex-col', className)} {...rest}>
        {header && <div className="shrink-0 border-b border-border">{header}</div>}
        <div
          tabIndex={-1}
          // Normal tabs: the body is the scroller (`overflow-auto`). When the
          // active tab contains a sticky table, the body stops scrolling and
          // becomes a plain flex column (`min-h-0 overflow-hidden`) so the
          // definite-height chain runs down to the card, which owns the scroll
          // (CORE-1009). `p-canvas` now frames the card on all sides — the body
          // no longer scrolls, so the old `sticky-scrollport` padding→spacer
          // swap is unnecessary.
          className="flex flex-1 flex-col gap-4 overflow-auto p-canvas focus:outline-none has-data-sticky-table:min-h-0 has-data-sticky-table:overflow-hidden"
        >
          {summary}
          {tabs}
        </div>
        {editDialogProps && (
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <Dialog.Content
              size={editDialogProps.size}
              data-testid={editDialogProps['data-testid']}
            >
              <Dialog.Header>
                <Dialog.Title>{editDialogProps.title}</Dialog.Title>
                <Dialog.Close />
              </Dialog.Header>
              <Dialog.Body>{editDialogProps.children}</Dialog.Body>
            </Dialog.Content>
          </Dialog>
        )}
      </div>
    </DetailViewContext>
  )
}
