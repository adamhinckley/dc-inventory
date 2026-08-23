import {
  DrawerRoot,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
} from './Drawer'

export type {
  DrawerRootProps,
  DrawerTriggerProps,
  DrawerContentProps,
  DrawerHeaderProps,
  DrawerBodyProps,
  DrawerFooterProps,
  DrawerTitleProps,
  DrawerDescriptionProps,
  DrawerCloseProps,
} from './Drawer'

/**
 * Side-anchored sliding panel. Full-height overlay anchored to the left or
 * right edge with a backdrop, focus trap, and Escape-to-dismiss.
 *
 * @when Long-form content where the rest of the page should remain visible:
 *   filter panels, multi-step forms, contextual detail. Settings panels.
 * @avoid Short confirmations and focused modal forms — use `Dialog`. Tooltips
 *   and small popovers — use `Popover`.
 * @variants side (`left`/`right`), size (`sm`/`md`/`lg`)
 */
export const Drawer = Object.assign(DrawerRoot, {
  Trigger: DrawerTrigger,
  Content: DrawerContent,
  Header: DrawerHeader,
  Body: DrawerBody,
  Footer: DrawerFooter,
  Title: DrawerTitle,
  Description: DrawerDescription,
  Close: DrawerClose,
})
