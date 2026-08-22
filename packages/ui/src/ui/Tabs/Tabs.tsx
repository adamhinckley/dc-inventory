import type { ComponentPropsWithRef } from 'react'
import { Tabs as BaseTabs } from '@base-ui-components/react/tabs'
import { cn } from '#cn'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/** Accepted tab value types — matches Base UI's TabsTab.Value */
type TabValue = string | number

export type TabsRootProps = ComponentPropsWithRef<'div'> & {
  /** The value of the active tab (controlled) */
  value?: TabValue | null
  /** Default active tab (uncontrolled) */
  defaultValue?: TabValue | null
  /** Called when the active tab changes */
  onValueChange?: (value: TabValue | null) => void
  /**
   * Required. Format: `{feature}-{view}-{element}`.
   * Example: `accounts-detail-tabs`.
   * See `.claude/rules/concepts/testid.md` for the full spec.
   */
  'data-testid'?: string
}

export type TabsListProps = ComponentPropsWithRef<'div'>

export type TabsTriggerProps = ComponentPropsWithRef<'button'> & {
  /** Identifies which panel this tab controls */
  value: TabValue
}

export type TabsPanelProps = ComponentPropsWithRef<'div'> & {
  /** The value matching the corresponding trigger */
  value: TabValue
  /**
   * Keep the panel mounted (hidden via CSS) when inactive.
   *
   * Defaults to `true` because most tabs in this app contain state worth
   * preserving across switches — filter chips, search input, scroll
   * position, in-flight queries. Tearing down the subtree on every switch
   * resets that state and feels broken.
   *
   * Opt out (`keepMounted={false}`) for tabs whose content is genuinely
   * expensive to render and rarely revisited (e.g. very large logs).
   */
  keepMounted?: boolean
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

/**
 * Tabs container. Holds the active value and provides Base UI's Tabs context
 * to descendants.
 *
 * @when Wrap a `Tabs.List` plus one `Tabs.Panel` per tab.
 * @example
 * <Tabs defaultValue="overview">
 *   <Tabs.List>
 *     <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
 *     <Tabs.Trigger value="activity">Activity</Tabs.Trigger>
 *   </Tabs.List>
 *   <Tabs.Panel value="overview">...</Tabs.Panel>
 *   <Tabs.Panel value="activity">...</Tabs.Panel>
 * </Tabs>
 */
export function TabsRoot({
  ref,
  className,
  value,
  defaultValue,
  onValueChange,
  children,
  ...rest
}: TabsRootProps) {
  return (
    <BaseTabs.Root
      ref={ref}
      value={value}
      defaultValue={defaultValue}
      onValueChange={
        onValueChange
          ? (val: TabValue | null) => {
              onValueChange(val)
            }
          : undefined
      }
      className={cn('section-flat rounded-section', className)}
      {...rest}
    >
      {children}
    </BaseTabs.Root>
  )
}

/**
 * Tab strip. Horizontal row of `Tabs.Trigger` children with a bottom border.
 *
 * @when Direct child of `<Tabs>`. One per Tabs instance.
 */
export function TabsList({ ref, className, children, ...rest }: TabsListProps) {
  return (
    <BaseTabs.List
      ref={ref}
      className={cn('relative flex border-b border-border', className)}
      {...rest}
    >
      {children}
    </BaseTabs.List>
  )
}

/**
 * Single tab. Selected when `value` matches the Tabs Root's value; selection
 * is reflected by the active indicator stripe and `aria-selected`.
 *
 * @when Inside `Tabs.List`. The `value` must match a `Tabs.Panel`'s `value`.
 */
export function TabsTrigger({ ref, className, children, ...rest }: TabsTriggerProps) {
  return (
    <BaseTabs.Tab
      ref={ref}
      className={cn(
        'tab-trigger section-tab',
        'aria-selected:section-tab-active aria-selected:border-accent-indicator',
        className,
      )}
      {...rest}
    >
      {children}
    </BaseTabs.Tab>
  )
}

/**
 * Panel for one tab. Mounted-but-hidden when inactive by default
 * (`keepMounted=true`) so in-tab state (filter chips, search input, scroll
 * position, in-flight queries) survives switching.
 *
 * @when One per `Tabs.Trigger`, with matching `value`.
 * @avoid Setting `keepMounted={false}` unless the panel content is genuinely
 *   expensive to render and rarely revisited — tearing down on every switch
 *   loses state and feels broken.
 */
export function TabsPanel({
  ref,
  className,
  children,
  keepMounted = true,
  ...rest
}: TabsPanelProps) {
  return (
    <BaseTabs.Panel
      ref={ref}
      keepMounted={keepMounted}
      className={cn('p-card', className)}
      {...rest}
    >
      {children}
    </BaseTabs.Panel>
  )
}
