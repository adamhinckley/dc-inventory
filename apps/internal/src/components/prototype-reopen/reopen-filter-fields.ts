import { CATEGORIES, FACTORIES } from "./fake-catalog";
import type { FilterField } from "./resource-filter-bar";

export const reopenFilterFields: Record<string, FilterField> = {
  factory: {
    label: "Factory",
    filter: {
      kind: "select",
      options: FACTORIES.map((value) => ({ value, label: value })),
    },
  },
  category: {
    label: "Category",
    filter: {
      kind: "select",
      options: CATEGORIES.map((value) => ({ value, label: value })),
    },
  },
  sellState: {
    label: "Sell State",
    filter: {
      kind: "select",
      options: [
        { value: "locked", label: "Locked" },
        { value: "open", label: "Open" },
      ],
    },
  },
  active: { label: "Active", filter: { kind: "boolean" } },
  discontinued: { label: "Discontinued", filter: { kind: "boolean" } },
  webWholesale: { label: "On Wholesale Shop", filter: { kind: "boolean" } },
  excludeNeverOpen: { label: "Exclude Year-Round", filter: { kind: "boolean" } },
  hasFloorStock: { label: "Has Floor Stock", filter: { kind: "boolean" } },
  hasOnOrder: { label: "Has Qty On PO", filter: { kind: "boolean" } },
  sellWindow: {
    label: "Sell Window",
    filter: {
      kind: "select",
      options: [
        { value: "none", label: "No Window" },
        { value: "set", label: "Window Set" },
      ],
    },
  },
  newThisPresell: { label: "New This Pre-Sell", filter: { kind: "boolean" } },
};
