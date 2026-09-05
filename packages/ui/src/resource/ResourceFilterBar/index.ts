import {
  ResourceFilterBarRoot,
  ResourceFilterBarSearch,
  ResourceFilterBarChips,
} from "./ResourceFilterBar";

export type {
  ResourceFilterBarRootProps as ResourceFilterBarProps,
  ResourceFilterBarSearchProps,
  ResourceFilterBarChipsProps,
} from "./ResourceFilterBar";

/**
 * Resource filter strip. Search + active-filter chips + Add Filter menu,
 * driven by a `FilterState` controller.
 *
 * @when Explorer and list views whose filters come from a field map.
 * @avoid Ad-hoc one-off filter UIs — compose `Popover` + `Menu` directly.
 */
export const ResourceFilterBar = Object.assign(ResourceFilterBarRoot, {
  Search: ResourceFilterBarSearch,
  Chips: ResourceFilterBarChips,
});
