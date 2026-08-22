import {
  PanelRoot,
  PanelHeader,
  PanelBody,
  PanelTitleRoot,
  PanelTitleIcon,
  PanelTitleText,
  PanelActionsRoot,
} from './Panel'

const PanelTitle = Object.assign(PanelTitleRoot, {
  Icon: PanelTitleIcon,
  Text: PanelTitleText,
})

/**
 * Section-elevation card with header + body slots and a flex-grow basis so
 * panels in a row distribute width evenly.
 *
 * @when Dashboard cards, summary widgets, sidebar info panels — bordered
 *   containers that hold a heading row (icon + title + actions) and a body.
 * @avoid Detail key/value displays — use `DescriptionList`. Tab panels — the
 *   tab itself owns its container.
 * @variants variant (`primary`/`secondary`), size (`sm`/`md`/`lg`/`xl`)
 */
export const Panel = Object.assign(PanelRoot, {
  Header: PanelHeader,
  Body: PanelBody,
  Title: PanelTitle,
  Actions: PanelActionsRoot,
})
