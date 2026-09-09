"use client";

import { useListWholesaleCategories } from "@dc-inventory/api-client-wholesale";
import type { CatalogBrowseParams } from "../lib/catalog-list-params";

/** Sidebar / filter-drawer body: in-stock toggle first, then the category list. */
export function CatalogFilters({
  params,
  onChange,
  idPrefix = "filters",
}: {
  params: CatalogBrowseParams;
  onChange: (patch: Partial<CatalogBrowseParams>) => void;
  idPrefix?: string;
}) {
  const categories = useListWholesaleCategories();
  const payload = categories.data?.data;
  const names = payload !== undefined && "items" in payload ? payload.items.map((c) => c.name) : [];
  const activeCategory = params.category;
  const showAvailableOnly = params.availableOnly !== false;

  const itemClass = (active: boolean) =>
    `flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
      active
        ? "bg-canvas-muted font-semibold text-accent"
        : "text-ink-subtle hover:bg-canvas-muted hover:text-ink"
    }`;

  return (
    <div className="flex min-h-0 flex-col gap-8">
      <section aria-labelledby={`${idPrefix}-availability`} className="shrink-0">
        <h2 id={`${idPrefix}-availability`} className="section-title mb-3">
          Availability
        </h2>
        <label className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink hover:bg-canvas-muted">
          <input
            type="checkbox"
            checked={showAvailableOnly}
            onChange={(event) => onChange({ availableOnly: event.target.checked })}
            className="size-4 rounded border-line accent-accent"
          />
          <span className="font-medium">In stock only</span>
        </label>
      </section>

      <section
        aria-labelledby={`${idPrefix}-categories`}
        className="min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain"
      >
        <h2 id={`${idPrefix}-categories`} className="section-title mb-3">
          Categories
        </h2>
        <ul className="flex flex-col gap-0.5">
          <li>
            <button
              type="button"
              aria-current={activeCategory === undefined ? "true" : undefined}
              onClick={() => onChange({ category: undefined })}
              className={itemClass(activeCategory === undefined)}
            >
              All products
            </button>
          </li>
          {categories.isPending
            ? Array.from({ length: 6 }, (_, index) => (
                <li key={index} className="px-3 py-2">
                  <span className="shop-skeleton block h-4 w-2/3 rounded" />
                </li>
              ))
            : names.map((name) => (
                <li key={name}>
                  <button
                    type="button"
                    aria-current={activeCategory === name ? "true" : undefined}
                    onClick={() => onChange({ category: name })}
                    className={itemClass(activeCategory === name)}
                  >
                    <span className="truncate">{name}</span>
                  </button>
                </li>
              ))}
        </ul>
      </section>
    </div>
  );
}
