'use client'

import { type ReactElement } from 'react'
import { Tooltip as BaseTooltip } from '@base-ui-components/react/tooltip'

export interface TooltipProps {
  /** Tooltip text shown on hover/focus. When falsy, renders children as-is. */
  content: string | undefined | null
  /**
   * The trigger element. Must accept ref and event handler props (Base UI
   * clones the element via `render` and merges its own handlers + aria attrs).
   * The element's own children are preserved.
   */
  children: ReactElement<Record<string, unknown>>
  /**
   * Whether the tooltip stays open while the pointer moves onto the popup
   * itself. Defaults to Base UI's `true`. Set `false` for tooltips on
   * interactive triggers (e.g. table cell-action cells) where a lingering
   * popup would block clicks, sort, or other affordances on the element
   * underneath.
   */
  hoverable?: boolean
}

/**
 * General-purpose tooltip. Wraps any single element — hover or focus the
 * trigger to reveal a styled tooltip popup. Delay is inherited from the
 * root `Tooltip.Provider` in `providers.tsx` (300ms + group coordination).
 *
 * @when Inline hints on action cells, icon buttons, truncated text, or any
 *   element that benefits from a hover label. For help-icon tooltips with a
 *   title + description, use `TooltipHelp` instead.
 * @avoid Rich content — use `Popover`. Wrapping elements that don't forward
 *   ref/props (Base UI needs to attach event handlers to the trigger).
 * @tokens overlay (opaque E3 surface), z-popover (positioner z-index)
 */
export function Tooltip({ content, children, hoverable }: TooltipProps) {
  if (!content) return children

  return (
    <BaseTooltip.Root disableHoverablePopup={hoverable === false}>
      <BaseTooltip.Trigger render={children} />
      <BaseTooltip.Portal>
        <BaseTooltip.Positioner sideOffset={6} className="z-popover">
          <BaseTooltip.Popup className="overlay max-w-[320px] rounded-section px-2.5 py-1.5 shadow-overlay">
            <BaseTooltip.Arrow />
            <p className="overlay-description">{content}</p>
          </BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  )
}
