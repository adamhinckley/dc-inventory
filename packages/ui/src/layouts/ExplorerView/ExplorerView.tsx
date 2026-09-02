'use client'

import {
  Children,
  createContext,
  isValidElement,
  use,
  useState,
  type ComponentPropsWithRef,
  type ReactNode,
} from 'react'
import { Plus } from 'lucide-react'
import { cn } from '#cn'
import { Button, type ButtonProps } from '#ds/ui/Button'
import { Dialog } from '#ds/ui/Dialog'

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface ExplorerViewContextValue {
  createOpen: boolean
  setCreateOpen: (open: boolean) => void
  hasCreateDialog: boolean
}

const ExplorerViewContext = createContext<ExplorerViewContextValue | null>(null)

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Access ExplorerView state from any descendant. Returns `createOpen`,
 * `setCreateOpen`, and `hasCreateDialog`.
 */
export function useExplorerView() {
  const ctx = use(ExplorerViewContext)
  if (!ctx) throw new Error('useExplorerView must be used within <ExplorerView>')
  return ctx
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ExplorerViewProps extends ComponentPropsWithRef<'div'> {
  children: ReactNode
}

export interface ExplorerViewHeaderProps extends ComponentPropsWithRef<'div'> {
  children: ReactNode
}

export interface ExplorerViewContentProps extends ComponentPropsWithRef<'div'> {
  children: ReactNode
}

export interface ExplorerViewFooterProps extends ComponentPropsWithRef<'div'> {
  children: ReactNode
}

export interface ExplorerViewCreateDialogProps {
  title: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  children: ReactNode
  /**
   * Required. Format: `{feature}-{view}-{element}`.
   * Example: `accounts-create-form-dialog`.
   * See `.claude/rules/concepts/testid.md` for the full spec.
   */
  'data-testid'?: string
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface SplitResult {
  header: ReactNode
  content: ReactNode
  footer: ReactNode
  createDialog: { props: ExplorerViewCreateDialogProps } | null
}

function splitChildren(children: ReactNode): SplitResult {
  let header: ReactNode = null
  let content: ReactNode = null
  let footer: ReactNode = null
  let createDialog: SplitResult['createDialog'] = null

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return
    if (child.type === ExplorerViewHeader) header = child
    else if (child.type === ExplorerViewContent) content = child
    else if (child.type === ExplorerViewFooter) footer = child
    else if (child.type === ExplorerViewCreateDialog)
      createDialog = child as unknown as SplitResult['createDialog']
  })

  return { header, content, footer, createDialog }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/**
 * Top-level header region. Canvas padding and a bottom border; override
 * with `className="border-b-0"` when content already draws its own chrome.
 *
 * @when Page titles, breadcrumbs, action bars, or navigation controls.
 * @tokens px-canvas py-region-y (region padding), border-border (header divider)
 */
export function ExplorerViewHeader({ children, className, ref, ...rest }: ExplorerViewHeaderProps) {
  return (
    <div
      ref={ref}
      className={cn('flex-shrink-0 border-b border-border px-canvas py-region-y', className)}
      {...rest}
    >
      {children}
    </div>
  )
}

/**
 * Bottom-pinned action region. Renders after Content as a flex-shrink-0
 * bar with a top border so primary page actions stay visible while the
 * content region scrolls.
 *
 * @when Page-level submit / confirm actions that must remain on screen
 *   (receive, save, commit).
 * @avoid Section actions that belong with a single card — keep those in
 *   Content. Modal actions — use `Dialog.Footer`.
 * @tokens px-canvas py-region-y (region padding), border-border (top divider)
 */
export function ExplorerViewFooter({ children, className, ref, ...rest }: ExplorerViewFooterProps) {
  return (
    <div ref={ref} className={cn('flex-shrink-0 px-canvas py-region-y', className)} {...rest}>
      {children}
    </div>
  )
}

/**
 * Scrollable content area that fills all remaining vertical space. A
 * `<Table sticky>` child caps itself at this container's content height
 * (`max-h-full`) and scrolls its rows internally (CORE-990) — this container
 * itself then never scrolls; its canvas padding frames the card on all
 * sides at every scroll position.
 *
 * @when Primary page content — lists, grids, cards, tables.
 * @tokens p-canvas (content padding)
 */
export function ExplorerViewContent({
  children,
  className,
  ref,
  ...rest
}: ExplorerViewContentProps) {
  // tabIndex={-1} keeps Firefox from inserting the scroll container into
  // the tab sequence (default behavior for `overflow:auto` regions).
  // Children inside are always focusable, so arrow-key scrolling still
  // works via the focused child.
  return (
    <div
      ref={ref}
      tabIndex={-1}
      className={cn(
        'flex-1 overflow-auto p-canvas focus:outline-none',
        'has-data-sticky-table:flex has-data-sticky-table:min-h-0 has-data-sticky-table:flex-col has-data-sticky-table:overflow-hidden',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
}

/**
 * Marker component for a create dialog. Does not render itself — the root
 * detects it via `splitChildren`, extracts its props, and renders a `Dialog`
 * at the end of the tree.
 *
 * @when The explorer view needs a "Create" action with a modal form.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function ExplorerViewCreateDialog(_props: ExplorerViewCreateDialogProps) {
  return null
}

export interface ExplorerViewCreateButtonProps
  extends Omit<ComponentPropsWithRef<'button'>, 'type'>, Pick<ButtonProps, 'variant' | 'size'> {
  /**
   * Required. Format: `{feature}-{view}-{element}`.
   * Example: `accounts-explorer-create-trigger`.
   * See `.claude/rules/concepts/testid.md` for the full spec.
   */
  'data-testid'?: string
}

/**
 * Renders a "Create" button that opens the CreateDialog. Only visible when a
 * `<ExplorerView.CreateDialog>` is present. Place inside `PageHeader.Actions`
 * or wherever the trigger should appear.
 *
 * Defaults to `variant="primary"` and `size="sm"`. Consumers can override
 * either by passing a different value.
 *
 * @when Pairing with ExplorerView.CreateDialog to provide the trigger button.
 */
export function ExplorerViewCreateButton({
  className,
  ref,
  variant = 'primary',
  size = 'sm',
  'data-testid': testid,
  ...rest
}: ExplorerViewCreateButtonProps) {
  const ctx = use(ExplorerViewContext)
  if (!ctx?.hasCreateDialog) return null

  return (
    <Button
      ref={ref}
      variant={variant}
      size={size}
      className={className}
      onClick={() => ctx.setCreateOpen(true)}
      data-testid={testid}
      {...rest}
    >
      <Plus className="size-icon-lg" />
      Create
    </Button>
  )
}

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

/**
 * Explorer-style layout that structures the content area into a Header,
 * scrollable Content region, optional Footer, and an optional create Dialog.
 * Sub-components are slotted by type — place them in any order.
 *
 * Provides context so `ExplorerView.CreateButton` can open the dialog from
 * anywhere within the tree.
 *
 * @when Building list/grid explorer pages with an optional create action.
 * @avoid Using without a Header or Content sub-component.
 */
export function ExplorerViewRoot({ children, className, ref, ...rest }: ExplorerViewProps) {
  const { header, content, footer, createDialog } = splitChildren(children)
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <ExplorerViewContext value={{ createOpen, setCreateOpen, hasCreateDialog: !!createDialog }}>
      <div ref={ref} className={cn('flex h-full flex-col', className)} {...rest}>
        {header && <div className="flex-shrink-0">{header}</div>}

        {content}

        {footer && <div className="flex-shrink-0 border-t border-border">{footer}</div>}

        {createDialog && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <Dialog.Content
              size={createDialog.props.size ?? 'lg'}
              data-testid={createDialog.props['data-testid']}
            >
              <Dialog.Header>
                <Dialog.Title>{createDialog.props.title}</Dialog.Title>
                <Dialog.Close />
              </Dialog.Header>
              <Dialog.Body>{createDialog.props.children}</Dialog.Body>
            </Dialog.Content>
          </Dialog>
        )}
      </div>
    </ExplorerViewContext>
  )
}
