import {
  DialogRoot,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from './Dialog'

export type {
  DialogRootProps,
  DialogTriggerProps,
  DialogContentProps,
  DialogHeaderProps,
  DialogBodyProps,
  DialogFooterProps,
  DialogTitleProps,
  DialogDescriptionProps,
  DialogCloseProps,
} from './Dialog'

/**
 * Modal dialog. Centered overlay with a backdrop, focus trap, and
 * Escape-to-dismiss.
 *
 * @when Confirmations, focused forms, blocking critical information.
 * @avoid Long content that needs the rest of the page visible — use
 *   `Drawer`. Tooltips and small popovers — use `Popover`.
 * @variants size (`sm`/`md`/`lg`/`xl`)
 */
export const Dialog = Object.assign(DialogRoot, {
  Trigger: DialogTrigger,
  Content: DialogContent,
  Header: DialogHeader,
  Body: DialogBody,
  Footer: DialogFooter,
  Title: DialogTitle,
  Description: DialogDescription,
  Close: DialogClose,
})
