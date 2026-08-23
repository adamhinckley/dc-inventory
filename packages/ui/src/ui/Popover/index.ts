import { PopoverRoot, PopoverTrigger, PopoverContent } from './Popover'

export type { PopoverChangeEventDetails } from './Popover'

/**
 * Floating panel anchored to a trigger. Hosts free-form content (filters,
 * compact forms, rich previews) without the focus trap of a dialog.
 *
 * @when Compact, dismissible content tied to an anchor element — filter
 *   builders, color pickers, info popovers, mini-forms.
 * @avoid Lists of selectable actions — use `Menu`. Long-form panels — use
 *   `Drawer`. Modal confirmations — use `Dialog`.
 */
export const Popover = Object.assign(PopoverRoot, {
  Trigger: PopoverTrigger,
  Content: PopoverContent,
})
