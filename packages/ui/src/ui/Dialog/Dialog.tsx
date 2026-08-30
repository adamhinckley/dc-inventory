'use client'

import type { ComponentPropsWithRef, ReactElement } from 'react'
import { Dialog as BaseDialog } from '@base-ui-components/react/dialog'
import { cva, type VariantProps } from 'class-variance-authority'
import { X } from 'lucide-react'
import { cn } from '#cn'

// ---------------------------------------------------------------------------
// Variants
// ---------------------------------------------------------------------------

const dialogContentVariants = cva(
  'flex max-h-[85vh] min-h-0 flex-col overflow-hidden overlay rounded-section shadow-modal outline-hidden transition-[opacity,transform] duration-200 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0',
  {
    variants: {
      size: {
        sm: 'w-full max-w-sm',
        md: 'w-full max-w-lg',
        lg: 'w-full max-w-2xl',
        xl: 'w-full max-w-4xl',
        cover: 'h-full w-full max-h-none',
      },
    },
    defaultVariants: { size: 'md' },
  },
)

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DialogRootProps {
  children: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export interface DialogTriggerProps {
  children?: React.ReactNode
  className?: string
  /**
   * Render-as override. When provided, `Dialog.Trigger` composes its open
   * behavior + ARIA onto the supplied element (typically `<Button …>`)
   * instead of rendering a default `<button>` wrapper. Use whenever the
   * trigger is an interactive component that already renders its own
   * `<button>` — passing it as `children` produces invalid `<button> > <button>` DOM.
   */
  render?: ReactElement<Record<string, unknown>>
  /**
   * Required. Format: `{feature}-{view}-{element}`.
   * Example: `accounts-explorer-create-trigger`.
   * See `.claude/rules/concepts/testid.md` for the full spec.
   */
  'data-testid'?: string
}

export interface DialogContentProps
  extends ComponentPropsWithRef<'div'>, VariantProps<typeof dialogContentVariants> {
  /**
   * Required. Format: `{feature}-{view}-{element}`.
   * Example: `accounts-create-form-dialog`.
   * See `.claude/rules/concepts/testid.md` for the full spec.
   */
  'data-testid'?: string
}

export type DialogHeaderProps = ComponentPropsWithRef<'div'>

export type DialogBodyProps = ComponentPropsWithRef<'div'>

export type DialogFooterProps = ComponentPropsWithRef<'div'>

export type DialogTitleProps = ComponentPropsWithRef<'h2'>

export type DialogDescriptionProps = ComponentPropsWithRef<'p'>

export interface DialogCloseProps extends ComponentPropsWithRef<'button'> {
  /**
   * Render-as override. When provided, `Dialog.Close` composes its dismiss
   * onClick + ARIA onto the supplied element (typically `<Button variant="ghost" />`)
   * instead of rendering the default X-icon button. Use for footer-level
   * Cancel actions; omit for the X-icon close in the header.
   */
  render?: ReactElement<Record<string, unknown>>
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

/**
 * Dialog state root. Controls open/close.
 *
 * @when Wrap a `Dialog.Trigger` and `Dialog.Content`. Always the outermost piece.
 */
export function DialogRoot({ children, open, onOpenChange }: DialogRootProps) {
  return (
    <BaseDialog.Root open={open} onOpenChange={onOpenChange}>
      {children}
    </BaseDialog.Root>
  )
}

/**
 * Dialog opener. Two modes:
 *
 *   - **Default** — renders its own `<button>` (via Base UI) wrapping
 *     `children`. Use only when children are non-interactive content
 *     (icon + text, plain markup) styled directly via `className`.
 *   - **`render` override** — composes the trigger behavior + ARIA onto the
 *     supplied element. Use whenever the trigger is itself an interactive
 *     component (`<Button>`, `<IconButton>`) that renders its own `<button>` —
 *     passing it as `children` produces invalid `<button> > <button>` DOM.
 *
 * @when Any element that opens the dialog.
 * @avoid Passing a `<Button>` (or any element rendering a `<button>`) as
 *   `children` — use `render` instead.
 * @example
 * // Interactive component as the trigger
 * <Dialog.Trigger render={<Button variant="primary">New user</Button>} />
 *
 * // Plain markup as the trigger
 * <Dialog.Trigger className="text-sm underline">Open</Dialog.Trigger>
 */
export function DialogTrigger({
  children,
  className,
  render,
  'data-testid': testid,
}: DialogTriggerProps) {
  if (render) {
    return (
      <BaseDialog.Trigger render={render} className={className} data-testid={testid}>
        {children}
      </BaseDialog.Trigger>
    )
  }
  return (
    <BaseDialog.Trigger className={cn('inline-flex', className)} data-testid={testid}>
      {children}
    </BaseDialog.Trigger>
  )
}

/**
 * Dialog container. Owns all outer padding (`px-region-x py-region-y`) so the
 * distance between the dialog border and any content is uniform on all four
 * sides. Sub-components (Header, Body, Footer) inherit this padding and must
 * not add their own horizontal padding or top/bottom edge padding. Every child
 * must be one of `Dialog.Header`, `Dialog.Body`, or `Dialog.Footer` — this
 * guarantees consistent spacing, scroll behavior, and layout regardless of
 * which sub-components are used.
 *
 * Sizes `sm`–`xl` are width caps on a content-fit dialog. `cover` fills the
 * viewport minus a 16px inset regardless of content — for drill-down modals
 * (heatmap cell → incident table, dashboard widget → detail table) where the
 * frame must stay fixed while content loads or pages change. Consumers with
 * genuinely narrow content can cap it: `size="cover" className="max-w-5xl"`.
 * For tables, pair `<Dialog.Body className="sticky-scrollport">` with
 * `<Table sticky>` (the explorer-view pattern) so the header and pagination
 * pin in view instead of scrolling out of the body.
 *
 * @when Wrap all dialog content. Always the only child of `<Dialog>` after `Dialog.Trigger`.
 * @avoid Passing raw elements directly as children — they'll have incorrect
 *   spacing. Adding horizontal padding to Header/Body/Footer — they inherit
 *   it from here.
 * @tokens overlay (container surface), z-popover (z-index), backdrop (scrim
 *   color), px-region-x/py-region-y (outer padding), rounded-section (corner
 *   radius)
 * @example
 * <Dialog.Content size="md">
 *   <Dialog.Header>
 *     <Dialog.Title>Confirm Deletion</Dialog.Title>
 *     <Dialog.Close />
 *   </Dialog.Header>
 *   <Dialog.Body>This action cannot be undone.</Dialog.Body>
 *   <Dialog.Footer>
 *     <Button variant="ghost">Cancel</Button>
 *     <Button variant="destructive">Delete</Button>
 *   </Dialog.Footer>
 * </Dialog.Content>
 */
export function DialogContent({ children, ref, className, size, ...rest }: DialogContentProps) {
  return (
    <BaseDialog.Portal>
      <BaseDialog.Backdrop className="fixed inset-0 z-popover bg-backdrop transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0" />
      <div className="fixed inset-0 z-popover flex items-center justify-center overflow-y-auto p-card">
        <BaseDialog.Popup
          ref={ref}
          className={cn(dialogContentVariants({ size }), 'px-region-x py-region-y', className)}
          {...rest}
        >
          {children}
        </BaseDialog.Popup>
      </div>
    </BaseDialog.Portal>
  )
}

/**
 * Dialog header. Layout only — no padding (DialogContent owns padding).
 *
 * @when Composing a Dialog with a title row. Pair with `Dialog.Title` and
 *   optionally `Dialog.Close`.
 * @avoid Adding horizontal padding here — the container owns it.
 */
export function DialogHeader({ ref, className, children, ...rest }: DialogHeaderProps) {
  return (
    <div
      ref={ref}
      className={cn('stacked flex shrink-0 items-center justify-between gap-region', className)}
      {...rest}
    >
      {children}
    </div>
  )
}

/**
 * Dialog body. Vertical breathing room and scroll behavior — no horizontal
 * padding (DialogContent owns padding).
 *
 * @when The middle slot of the dialog. Holds primary content.
 * @avoid Adding horizontal padding here — the container owns it. Setting
 *   typography on this container — text styling belongs on content elements.
 */
export function DialogBody({ ref, className, children, ...rest }: DialogBodyProps) {
  return (
    <div
      ref={ref}
      className={cn('stacked min-h-0 flex-1 overflow-y-auto py-section-content-y', className)}
      {...rest}
    >
      {children}
    </div>
  )
}

/**
 * Dialog footer. Action row with a top border separator and right-aligned
 * actions — no horizontal padding (DialogContent owns padding).
 *
 * @when Action buttons (Cancel, Confirm). Bottom slot of the dialog.
 * @avoid Adding horizontal padding here — the container owns it. Putting
 *   non-action content here — use `Dialog.Body`.
 */
export function DialogFooter({ ref, className, children, ...rest }: DialogFooterProps) {
  return (
    <div
      ref={ref}
      className={cn(
        'stacked flex shrink-0 items-center justify-end gap-action border-t border-border pt-region-y',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
}

/**
 * Dialog title heading. Renders the `overlay-title` text role.
 *
 * @when The first child of `Dialog.Header`.
 */
export function DialogTitle({ ref, className, children, ...rest }: DialogTitleProps) {
  return (
    <BaseDialog.Title ref={ref} className={cn('stacked overlay-title', className)} {...rest}>
      {children}
    </BaseDialog.Title>
  )
}

/**
 * Dialog description. Renders the `overlay-description` text role.
 *
 * @when Optional secondary text directly under `Dialog.Title`.
 */
export function DialogDescription({ ref, className, children, ...rest }: DialogDescriptionProps) {
  return (
    <BaseDialog.Description
      ref={ref}
      className={cn('stacked overlay-description', className)}
      {...rest}
    >
      {children}
    </BaseDialog.Description>
  )
}

/**
 * Dialog close button. Two modes:
 *
 *   - **Default** — renders a 32×32 X-icon button styled as `interactable subtle`.
 *     Use as the trailing item of `Dialog.Header`.
 *   - **`render` override** — composes the dismiss onClick + ARIA onto a
 *     supplied element (typically `<Button variant="ghost" />`). The X-icon
 *     wrapper styling and `aria-label` are skipped — the rendered element
 *     supplies its own visuals and label. Use for footer-level Cancel actions.
 *
 * @when Default mode in `Dialog.Header` for the X close. `render` mode in
 *   `Dialog.Footer` paired with a primary action.
 * @avoid Wrapping a `<Button>` (or any other interactive element) inside the
 *   default mode — it produces invalid `<button> > <button>` DOM and the
 *   inner element fights the 32×32 wrapper. Pass it via `render` instead.
 * @example
 * // Header X-icon
 * <Dialog.Close />
 *
 * // Footer cancel button
 * <Dialog.Close render={<Button variant="ghost" />}>Cancel</Dialog.Close>
 */
export function DialogClose({ ref, className, children, render, ...rest }: DialogCloseProps) {
  if (render) {
    return (
      <BaseDialog.Close ref={ref} render={render} className={className} {...rest}>
        {children}
      </BaseDialog.Close>
    )
  }
  return (
    <BaseDialog.Close
      ref={ref}
      className={cn(
        'stacked interactable subtle inline-flex h-8 w-8 items-center justify-center',
        className,
      )}
      aria-label="Close"
      {...rest}
    >
      {children ?? <X size={18} />}
    </BaseDialog.Close>
  )
}
