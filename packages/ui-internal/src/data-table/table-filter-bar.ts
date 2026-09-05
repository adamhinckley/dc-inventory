import type { FilterValue } from "@dc-inventory/ui";
import type { DataTableState } from "./list-params";
import type { TableMeta } from "./table-meta";

type FilterOption = { value: string; label: string };

export type TableFilterField = {
  label: string;
  filter:
    | { kind: "boolean" }
    | { kind: "select"; options?: { value: string; label: string }[] }
    | { kind: "multiselect"; options?: { value: string; label: string }[] }
    | { kind: "text" };
};

/**
 * Map declared `x-table` filters to ResourceFilterBar field slots.
 * Date filters stay on `DataTable.Filters` until a date chip lands in the kit.
 */
export function tableFilterFields(
  meta: TableMeta,
  filterOptions?: Partial<Record<string, readonly FilterOption[]>>,
  filterLabels?: Partial<Record<string, string>>,
): Record<string, TableFilterField> {
  const fields: Record<string, TableFilterField> = {};
  for (const filter of meta.filters ?? []) {
    if (filter.control === "date" || filter.control === "dateRange") {
      continue;
    }
    const label = filterLabels?.[filter.param] ?? filter.param;
    if (filter.control === "boolean") {
      fields[filter.param] = { label, filter: { kind: "boolean" } };
      continue;
    }
    if (filter.control === "select" || filter.control === "multiselect") {
      fields[filter.param] = {
        label,
        filter: {
          kind: filter.control,
          options: [...(filterOptions?.[filter.param] ?? [])],
        },
      };
      continue;
    }
    fields[filter.param] = { label, filter: { kind: "text" } };
  }
  return fields;
}

export type AppliedTableFilterValue = string | boolean | readonly string[] | undefined;

/** Persist a chip value into DataTable filter state. Null / empty is omitted from the API. */
export function appliedTableFilterValue(value: FilterValue): AppliedTableFilterValue {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (Array.isArray(value)) {
    const items = value.filter((item): item is string => typeof item === "string" && item !== "");
    return items.length === 0 ? undefined : items;
  }
  return undefined;
}

export function isAppliedTableFilter(
  value: DataTableState["filters"][string],
): boolean {
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return value !== undefined && value !== "";
}
