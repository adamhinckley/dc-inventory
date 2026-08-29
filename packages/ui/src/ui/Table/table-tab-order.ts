/** Input types that stay on the grid's roving tabindex (one tab stop). */
const ROVING_INPUT_TYPES = /^(checkbox|radio|button|submit|reset|hidden|file)$/i

/**
 * Text-like fields keep sequential Tab order so a qty column can be edited
 * down the list. Buttons, links, and checkboxes stay on the roving model.
 */
export function isSequentialTableTabField(el: {
  tagName: string
  type?: string
}): boolean {
  if (el.tagName === "TEXTAREA") return true
  if (el.tagName !== "INPUT") return false
  return !ROVING_INPUT_TYPES.test(el.type ?? "text")
}

export function tableCellTabIndex(
  sequential: boolean,
  isActiveCell: boolean,
): 0 | -1 {
  if (sequential || isActiveCell) return 0
  return -1
}

export function tableRowTabIndex(
  isActiveRowAnchor: boolean,
  hasSequentialField: boolean,
): 0 | -1 {
  if (hasSequentialField) return -1
  return isActiveRowAnchor ? 0 : -1
}
