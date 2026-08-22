import type { ComponentPropsWithRef } from 'react'
import { cn } from '#cn'
import { Skeleton } from '#ds/ui/Skeleton'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PageHeaderProps extends ComponentPropsWithRef<'div'> {
  /**
   * Required. Format: `{feature}-{view}-{element}`.
   * Example: `accounts-explorer-page-header`.
   * See `.claude/rules/concepts/testid.md` for the full spec.
   */
  'data-testid'?: string
}

export type PageHeaderHeaderRowProps = ComponentPropsWithRef<'div'>

export type PageHeaderContentProps = ComponentPropsWithRef<'div'>

export interface PageHeaderTitleProps extends ComponentPropsWithRef<'h1'> {
  /** Render a skeleton placeholder inside the heading while data loads. */
  isPending?: boolean
}

export interface PageHeaderSubtitleProps extends ComponentPropsWithRef<'p'> {
  /** Render a skeleton placeholder inside the subtitle while data loads. */
  isPending?: boolean
}

export type PageHeaderActionsProps = ComponentPropsWithRef<'div'>

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

/**
 * PageHeader container. Vertical stack with `gap-3` between the title row
 * and any breadcrumbs or supplementary content.
 *
 * @when Wrap a `PageHeader.HeaderRow` and any optional supporting content.
 * @example
 * <PageHeader>
 *   <PageHeader.HeaderRow>
 *     <PageHeader.Content>
 *       <PageHeader.Title>Account</PageHeader.Title>
 *       <PageHeader.Subtitle>Acme, Inc.</PageHeader.Subtitle>
 *     </PageHeader.Content>
 *     <PageHeader.Actions>
 *       <Button>New incident</Button>
 *     </PageHeader.Actions>
 *   </PageHeader.HeaderRow>
 * </PageHeader>
 */
export function PageHeaderRoot({ ref, className, children, ...rest }: PageHeaderProps) {
  return (
    <div ref={ref} className={cn('flex flex-col gap-3', className)} {...rest}>
      {children}
    </div>
  )
}

/**
 * Title row. Pairs `PageHeader.Content` (title + subtitle) on the left with
 * `PageHeader.Actions` on the right via `justify-between`.
 *
 * @when Direct child of `<PageHeader>`. One per PageHeader.
 */
export function PageHeaderHeaderRow({
  ref,
  className,
  children,
  ...rest
}: PageHeaderHeaderRowProps) {
  return (
    <div
      ref={ref}
      className={cn('flex items-start justify-between gap-region', className)}
      {...rest}
    >
      {children}
    </div>
  )
}

/**
 * Title + subtitle column inside the header row.
 *
 * @when Inside `PageHeader.HeaderRow`. Holds `PageHeader.Title` and
 *   optionally `PageHeader.Subtitle`.
 */
export function PageHeaderContent({ ref, className, children, ...rest }: PageHeaderContentProps) {
  return (
    <div ref={ref} className={cn('flex flex-col', className)} {...rest}>
      {children}
    </div>
  )
}

/**
 * Page title. Renders an `<h1>` styled as `text-title-lg`. Pass `isPending`
 * to swap the children for a skeleton placeholder while data loads.
 *
 * @when First child of `PageHeader.Content`.
 */
export function PageHeaderTitle({
  ref,
  className,
  children,
  isPending,
  ...rest
}: PageHeaderTitleProps) {
  return (
    <h1 ref={ref} className={cn('text-title-lg text-fg', className)} {...rest}>
      {isPending ? <Skeleton className="inline-block h-7 w-64 align-middle" /> : children}
    </h1>
  )
}

/**
 * Page subtitle. Renders a `<p>` in `text-body text-fg-tertiary`. Pass
 * `isPending` to swap children for a skeleton placeholder.
 *
 * @when Optional second child of `PageHeader.Content`.
 */
export function PageHeaderSubtitle({
  ref,
  className,
  children,
  isPending,
  ...rest
}: PageHeaderSubtitleProps) {
  return (
    <p ref={ref} className={cn('text-body text-fg-tertiary', className)} {...rest}>
      {isPending ? <Skeleton className="inline-block h-4 w-96 align-middle" /> : children}
    </p>
  )
}

/**
 * Right-aligned actions row in the header.
 *
 * @when Inside `PageHeader.HeaderRow`, opposite `PageHeader.Content`. Holds
 *   primary actions like "New incident", "Edit", action menus.
 */
export function PageHeaderActions({ ref, className, children, ...rest }: PageHeaderActionsProps) {
  return (
    <div ref={ref} className={cn('flex items-center gap-action', className)} {...rest}>
      {children}
    </div>
  )
}
