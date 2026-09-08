"use client";

import { Chip, TextInput } from "@dc-inventory/ui";
import type { FilterOption } from "@dc-inventory/ui-internal";
import type { ListQueryParams } from "@dc-inventory/ui-internal";

function toggleValue(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

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
  const suppliers = readStringArray(filters.supplierId);
  const excludeSuppliers = readStringArray(filters.excludeSupplierId);
  const search = typeof filters.q === "string" ? filters.q : "";

  return (
    <div className="flex flex-col gap-field-group">
      <div className="flex flex-wrap items-center gap-tight">
        <span className="text-label text-fg-secondary">Category</span>
        {categoryOptions.map((category) => (
          <button
            key={category.value}
            type="button"
            disabled={readOnly}
            onClick={() =>
              onChange({
                ...filters,
                category: toggleValue(categories, category.value),
              })
            }
          >
            <Chip
              className={
                categories.includes(category.value)
                  ? "[--chip-color:var(--color-brand-primary)]"
                  : "[--chip-color:var(--color-fg-secondary)]"
              }
            >
              {category.label}
            </Chip>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-tight">
        <span className="text-label text-fg-secondary">Factory</span>
        {supplierOptions.map((supplier) => (
          <button
            key={supplier.value}
            type="button"
            disabled={readOnly}
            onClick={() =>
              onChange({
                ...filters,
                supplierId: toggleValue(suppliers, supplier.value),
              })
            }
          >
            <Chip
              className={
                suppliers.includes(supplier.value)
                  ? "[--chip-color:var(--color-brand-primary)]"
                  : "[--chip-color:var(--color-fg-secondary)]"
              }
            >
              {supplier.label}
            </Chip>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-tight">
        <span className="text-label text-fg-secondary">Exclude factory</span>
        {supplierOptions.map((supplier) => (
          <button
            key={`exclude-${supplier.value}`}
            type="button"
            disabled={readOnly}
            onClick={() =>
              onChange({
                ...filters,
                excludeSupplierId: toggleValue(excludeSuppliers, supplier.value),
              })
            }
          >
            <Chip
              className={
                excludeSuppliers.includes(supplier.value)
                  ? "[--chip-color:var(--color-error)]"
                  : "[--chip-color:var(--color-fg-secondary)]"
              }
            >
              {supplier.label}
            </Chip>
          </button>
        ))}
      </div>
      <TextInput
        density="compact"
        className="w-52 shrink-0"
        placeholder="Search SKU or name"
        value={search}
        disabled={readOnly}
        onChange={(value) => onChange({ ...filters, q: value })}
      />
    </div>
  );
}
