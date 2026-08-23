/**
 * Boolean activation status chip — green/Active vs. red/Inactive — driven
 * by the `active` prop.
 *
 * @when Account, source, license, or integration activation state — any
 *   on/off status that maps cleanly to success/error.
 * @avoid Multi-state status (Open / Cleared / Snoozed) — render `Chip`
 *   directly with a CVA over the status enum.
 */
export { ActiveStatusChip, activeStatusField } from './ActiveStatusChip'
