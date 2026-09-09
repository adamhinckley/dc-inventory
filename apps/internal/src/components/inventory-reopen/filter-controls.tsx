"use client";

import { Combobox, FieldRow, Label, LabeledField, TextInput } from "@dc-inventory/ui";
import type { FilterOption } from "@dc-inventory/ui-internal";
import type { ListQueryParams } from "@dc-inventory/ui-internal";

function readStringArray(value: ListQueryParams[keyof ListQueryParams] | undefined): string[] {
  if (value === undefined) {
    return [];
  }
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  return [];
}

function nextList(next: string | string[] | null): string[] {
  return Array.isArray(next) ? next : [];
}

export function FilterControls({
  filters,
  onChange,
  categoryOptions,
  supplierOptions,
  readOnly = false,
}: {
  filters: ListQueryParams;
  onChange: (next: ListQueryParams) => void;
  categoryOptions: FilterOption[];
  supplierOptions: FilterOption[];
  readOnly?: boolean;
}) {
  const categories = readStringArray(filters.category);
  const excludeSuppliers = readStringArray(filters.excludeSupplierId);
  const search = typeof filters.q === "string" ? filters.q : "";

  return (
    <FieldRow>
      <LabeledField className="w-52 shrink-0">
        <Label htmlFor="sell-window-filter-category">Category</Label>
        <Combobox
          id="sell-window-filter-category"
          multiple
          virtualize
          density="compact"
          options={categoryOptions}
          value={categories}
          onChange={(next) =>
            onChange({ ...filters, category: nextList(next), supplierId: [] })
          }
          placeholder="Search categories"
          disabled={readOnly}
          data-testid="sell-window-filter-category"
        />
      </LabeledField>
      <LabeledField className="w-52 shrink-0">
        <Label htmlFor="sell-window-filter-exclude-factory">Exclude factory</Label>
        <Combobox
          id="sell-window-filter-exclude-factory"
          multiple
          virtualize
          density="compact"
          options={supplierOptions}
          value={excludeSuppliers}
          onChange={(next) =>
            onChange({
              ...filters,
              excludeSupplierId: nextList(next),
              supplierId: [],
            })
          }
          placeholder="Search factories to exclude"
          disabled={readOnly}
          data-testid="sell-window-filter-exclude-factory"
        />
      </LabeledField>
      <TextInput
        density="compact"
        className="w-52 shrink-0"
        placeholder="Search SKU or name"
        value={search}
        disabled={readOnly}
        onChange={(value) => onChange({ ...filters, q: value, supplierId: [] })}
      />
    </FieldRow>
  );
}
