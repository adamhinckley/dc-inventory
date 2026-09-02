import { BreadcrumbRoot, BreadcrumbItem } from './Breadcrumb'

export type { BreadcrumbProps, BreadcrumbItemProps } from './Breadcrumb'

/**
 * Hierarchical location trail. Items are separated by a forward chevron.
 *
 * @when App topbar page location on every dashboard route.
 * @avoid Slash separators — use the built-in chevron.
 */
export const Breadcrumb = Object.assign(BreadcrumbRoot, {
  Item: BreadcrumbItem,
})
