export type { FormDialogProps } from './FormDialog'

/**
 * Resource-form dialog. Trigger + dialog chrome + form + submit/cancel +
 * mutation wiring + server-error mapping in one component, so create/edit
 * dialogs collapse to schema + fields.
 *
 * @when Standard create/edit flows for a single resource — "New user",
 *   "Edit account", "Add source". The fast path for the common case.
 * @avoid Bespoke chrome — multi-section forms, custom footers, or
 *   non-standard trigger flows. Compose `<Dialog>` + `<Form>` directly
 *   instead. FormDialog is the fast path, not the only path.
 */
export { FormDialog } from './FormDialog'
