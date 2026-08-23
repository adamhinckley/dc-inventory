import type { ComponentPropsWithRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '#cn'

// ---------------------------------------------------------------------------
// Variants
// ---------------------------------------------------------------------------

const panelVariants = cva('rounded-section flex flex-col', {
  variants: {
    variant: {
      primary: 'section [--panel-bg:var(--color-surface-card)]',
      secondary: 'section-flat [--panel-bg:var(--color-surface-card)]',
    },
    size: {
      sm: 'min-w-40 flex-1 basis-40',
      md: 'min-w-48 flex-1 basis-48',
      lg: 'min-w-72 flex-1 basis-72',
      xl: 'min-w-96 flex-1 basis-96',
    },
  },
  defaultVariants: {
    variant: 'primary',
  },
})

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PanelRootProps
  extends ComponentPropsWithRef<'div'>, VariantProps<typeof panelVariants> {
  /**
   * Required. Format: `{feature}-{view}-{element}`.
   * Example: `dashboard-overview-active-threats-panel`.
   * See `.claude/rules/concepts/testid.md` for the full spec.
   */
  'data-testid'?: string
}

export type PanelHeaderProps = ComponentPropsWithRef<'div'>

export type PanelBodyProps = ComponentPropsWithRef<'div'>

export type PanelTitleRootProps = ComponentPropsWithRef<'div'>

export type PanelTitleIconProps = ComponentPropsWithRef<'div'>

export type PanelTitleTextProps = ComponentPropsWithRef<'h2'>

export type PanelActionsRootProps = ComponentPropsWithRef<'div'>

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

/**
 * Panel container. Picks `section` (primary) or `section-flat` (secondary)
 * based on `variant`. Sets `--panel-bg` so children
 * (`PanelHeader`/`PanelBody`) inherit the container background — this is the
 * compound CSS-variable pattern from `component.md`.
 *
 * @when Wrap a `Panel.Header` (optional) and `Panel.Body`. Always the
 *   outermost element.
 * @tokens section/section-flat (container surface), --panel-bg (child bg
 *   inheritance)
 * @example
 * <Panel size="md">
 *   <Panel.Header>
 *     <Panel.Title>
 *       <Panel.Title.Icon><ShieldIcon /></Panel.Title.Icon>
 *       <Panel.Title.Text>Active threats</Panel.Title.Text>
 *     </Panel.Title>
 *     <Panel.Actions>
 *       <Button variant="ghost">View all</Button>
 *     </Panel.Actions>
 *   </Panel.Header>
 *   <Panel.Body>...</Panel.Body>
 * </Panel>
 */
export function PanelRoot({ ref, className, children, variant, size, ...rest }: PanelRootProps) {
  return (
    <div ref={ref} className={cn(panelVariants({ variant, size }), className)} {...rest}>
      {children}
    </div>
  )
}

/**
 * Panel header. Title row that pairs `Panel.Title` with optional
 * `Panel.Actions`. Inherits `--panel-bg` from the root.
 *
 * Uses `p-card` (with a `pb-3` heading gap) so a Panel and a
 * `DescriptionList` placed side by side share identical header inset — their
 * titles align on the same top and left edge.
 *
 * @when Top slot of a Panel. Pair with one `Panel.Title` and at most one
 *   `Panel.Actions`.
 */
export function PanelHeader({ ref, className, children, ...rest }: PanelHeaderProps) {
  return (
    <div
      ref={ref}
      className={cn(
        'stacked px-card pt-card pb-3 flex min-w-0 items-center justify-between gap-region rounded-t-section bg-(--panel-bg)',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
}

/**
 * Panel body. Primary content slot. Rounds the corners that aren't
 * adjacent to a header (`first:rounded-t-section last:rounded-b-section`).
 *
 * Uses `p-card` to match the header inset. Drops its top padding when it
 * follows a header (the header's `pb-3` owns the heading gap); a header-less
 * body keeps the full `pt-card` via the `first:` variant.
 *
 * @when Primary content of the panel — list of items, chart, summary block.
 * @avoid Setting typography on this container — text styling belongs on
 *   content elements.
 */
export function PanelBody({ ref, className, children, ...rest }: PanelBodyProps) {
  return (
    <div
      ref={ref}
      className={cn(
        'stacked px-card pb-card pt-0 first:pt-card flex-1 text-sm first:rounded-t-section last:rounded-b-section bg-(--panel-bg)',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
}

/**
 * Title block in a Panel header. Holds an optional `Panel.Title.Icon` and a
 * `Panel.Title.Text`.
 *
 * @when Inside `Panel.Header`. Use the dotted compound (`Panel.Title.Icon`,
 *   `Panel.Title.Text`) to build the title, or pass children directly for
 *   ad-hoc layouts.
 */
export function PanelTitleRoot({ ref, className, children, ...rest }: PanelTitleRootProps) {
  return (
    <div ref={ref} className={cn('flex min-w-0 flex-1 items-center gap-icon', className)} {...rest}>
      {children}
    </div>
  )
}

/**
 * Leading icon for the Panel title.
 *
 * @when First child of `Panel.Title`. Optional.
 */
export function PanelTitleIcon({ ref, className, children, ...rest }: PanelTitleIconProps) {
  return (
    <div ref={ref} className={cn('flex-shrink-0 text-fg-tertiary', className)} {...rest}>
      {children}
    </div>
  )
}

/**
 * Panel title text. Renders an `<h2>` styled with the `section-content-heading`
 * role — the same panel/card identifier role a `DescriptionList.Heading` uses,
 * so a Panel and a DescriptionList sitting side by side share one header size.
 * `<h2>` sits directly below the page `<h1>` (`PageHeader.Title`), keeping the
 * document heading order unbroken.
 *
 * @when Child of `Panel.Title`, after an optional `Panel.Title.Icon`.
 */
export function PanelTitleText({ ref, className, children, ...rest }: PanelTitleTextProps) {
  return (
    <h2 ref={ref} className={cn('truncate section-content-heading', className)} {...rest}>
      {children}
    </h2>
  )
}

/**
 * Trailing actions slot in a Panel header. Right-aligned via the header's
 * `justify-between`.
 *
 * @when Inside `Panel.Header`, after `Panel.Title`. Holds menu triggers,
 *   "View all" links, refresh buttons.
 */
export function PanelActionsRoot({ ref, className, children, ...rest }: PanelActionsRootProps) {
  return (
    <div
      ref={ref}
      className={cn('flex flex-shrink-0 items-center gap-action', className)}
      {...rest}
    >
      {children}
    </div>
  )
}
