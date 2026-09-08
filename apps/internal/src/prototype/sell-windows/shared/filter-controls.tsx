"use client";

import { Chip, TextInput } from "@dc-inventory/ui";
import { PROTOTYPE_CATEGORIES, PROTOTYPE_SUPPLIERS } from "../mock-data";
import type { MatchFilters } from "../types";

function toggleValue(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export function FilterControls({
  filters,
  onChange,
  readOnly = false,
}: {
  filters: MatchFilters;
  onChange: (next: MatchFilters) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="flex flex-col gap-field-group">
      <div className="flex flex-wrap items-center gap-tight">
        <span className="text-label text-fg-secondary">Category</span>
        {PROTOTYPE_CATEGORIES.map((category) => (
          <button
            key={category}
            type="button"
            disabled={readOnly}
            onClick={() =>
              onChange({
                ...filters,
                categories: toggleValue(filters.categories, category),
              })
            }
          >
            <Chip
              className={
                filters.categories.includes(category)
                  ? "[--chip-color:var(--color-brand-primary)]"
                  : "[--chip-color:var(--color-fg-secondary)]"
              }
            >
              {category}
            </Chip>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-tight">
        <span className="text-label text-fg-secondary">Exclude factory</span>
        <span className="text-body-sm text-fg-secondary">(all others included)</span>
        {PROTOTYPE_SUPPLIERS.map((supplier) => (
          <button
            key={supplier.id}
            type="button"
            disabled={readOnly}
            onClick={() =>
              onChange({
                ...filters,
                excludeSuppliers: toggleValue(filters.excludeSuppliers, supplier.id),
              })
            }
          >
            <Chip
              className={
                filters.excludeSuppliers.includes(supplier.id)
                  ? "[--chip-color:var(--color-error)]"
                  : "[--chip-color:var(--color-fg-secondary)]"
              }
            >
              {supplier.name}
            </Chip>
          </button>
        ))}
      </div>
      <TextInput
        density="compact"
        className="w-52"
        placeholder="Search SKU or name"
        value={filters.search}
        disabled={readOnly}
        onChange={(value) => onChange({ ...filters, search: value })}
      />
    </div>
  );
}
