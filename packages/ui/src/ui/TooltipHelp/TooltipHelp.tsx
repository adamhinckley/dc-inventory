"use client";

import { type ReactElement, type ReactNode } from 'react'
import { Tooltip } from '@base-ui-components/react/tooltip'
import { HelpCircle } from 'lucide-react'
import { cn } from '#cn'

interface TooltipHelpBaseProps {
  title?: string
  description: string
  className?: string
  /**
   * Required. Format: `{feature}-{view}-{element}`.
   * Example: `accounts-create-form-name-help`.
   * Applied to the trigger element. See `.claude/rules/concepts/testid.md`.
   */
  'data-testid'?: string
}

export type TooltipHelpProps =
  | (TooltipHelpBaseProps & {
      asChild?: false
      /** Defaults to a HelpCircle icon. Pass children to use a custom trigger. */
      children?: ReactNode
    })
  | (TooltipHelpBaseProps & {
      asChild: true
      /**
       * In `asChild` mode the child becomes the tooltip trigger — Base UI
       * merges hover/focus handlers onto it. Must be a single React element
       * with a props bag (Base UI's render contract). Any HTML element type
       * satisfies it: `<th>`, `<Button>`, `<a>`, etc.
       */
      children: ReactElement<Record<string, unknown>>
    })

/**
 * Help-icon tooltip. Wraps Base UI's Tooltip with a default `HelpCircle`
 * trigger and overlay-token styling. Hover or focus the trigger to reveal.
 *
 * Focusable by default — the help text is often the only place a field's
 * definition exists (e.g. "exposure level", "average time to remove"), so
 * keyboard and touch users must be able to reach it. Safari skips plain
 * `<button>` elements in the tab order by default, so `tabIndex={0}` is set
 * explicitly to match Chrome and Firefox.
 *
 * When the tooltip sits inside an element that is already focusable (a
 * sortable `<th>`, a `<Button>` whose disabled-reason you're explaining),
 * pass `asChild` so the parent becomes the trigger — that keeps the tab
 * sequence to a single stop and lets Enter activate the underlying control.
 *
 * @when Inline help adjacent to form labels, settings, detail-view fields,
 *   or table headers where the surrounding label is too dense to expand.
 * @avoid Long-form content — use `Popover`. Toggleable info — use a
 *   `Dialog`.
 * @tokens overlay (opaque E3 surface), z-popover (positioner z-index)
 */
export function TooltipHelp(props: TooltipHelpProps) {
  const { title, description, 'data-testid': testid } = props

  return (
    <Tooltip.Root>
      {props.asChild ? (
        <Tooltip.Trigger render={props.children} data-testid={testid} />
      ) : (
        <Tooltip.Trigger
          // Safari skips plain `<button>` elements in sequential tab
          // navigation by default. Explicit `tabIndex={0}` keeps the help
          // tooltip reachable in Safari without the user changing system
          // settings, and matches Chrome/Firefox.
          tabIndex={0}
          data-testid={testid}
          className={cn(
            'inline-flex cursor-help items-center gap-1 align-middle border-0 bg-transparent p-0',
            'text-fg-tertiary hover:text-fg focus-visible:outline-1 focus-visible:outline-primary rounded-interactable',
            props.className,
          )}
        >
          {props.children ?? <HelpCircle className="size-icon" aria-hidden />}
        </Tooltip.Trigger>
      )}
      <Tooltip.Portal>
        <Tooltip.Positioner sideOffset={6} className="z-popover">
          <Tooltip.Popup className="overlay max-w-[320px] rounded-section p-3 shadow-overlay">
            <Tooltip.Arrow />
            {title && <div className="overlay-title mb-1">{title}</div>}
            <p className="overlay-description">{description}</p>
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}
