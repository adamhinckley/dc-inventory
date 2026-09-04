"use client";

import { useListWholesaleCatalog } from "@dc-inventory/api-client-wholesale";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import {
  buildCatalogListSearchParams,
  catalogListPageCount,
  parseCatalogListParams,
  wholesaleCatalogRequestParams,
  type CatalogBrowseParams,
} from "../lib/catalog-list-params";
import { ProductCard } from "./product-card";

export function ProductCardList() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = useMemo(
    () => parseCatalogListParams(searchParams),
    [searchParams],
  );
  const requestParams = useMemo(
    () => wholesaleCatalogRequestParams(params),
    [params],
  );
  const catalog = useListWholesaleCatalog(requestParams);

  const replaceParams = useCallback(
    (next: Partial<CatalogBrowseParams>) => {
      const merged = { ...params, ...next };
      const query = buildCatalogListSearchParams(merged);
      router.replace(query.length > 0 ? `${pathname}?${query}` : pathname);
    },
    [params, pathname, router],
  );

  if (catalog.isPending) {
    return <p className="text-ink-muted">Loading catalog…</p>;
  }

  const payload = catalog.data?.data;
  if (catalog.isError || !payload || !("items" in payload)) {
    return (
      <p className="text-sold-out" role="alert">
        Catalog is unavailable. Start the API with `pnpm dev:api` and reload.
      </p>
    );
  }

  const { items, page, pageSize, total } = payload;
  const pageCount = catalogListPageCount(total, pageSize);
  const showAvailableOnly = params.availableOnly !== false;
  const rangeStart = total === 0 || items.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = total === 0 || items.length === 0 ? 0 : Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-card px-4 py-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={showAvailableOnly}
            onChange={(event) =>
              replaceParams({
                availableOnly: event.target.checked,
                page: 1,
              })
            }
            className="size-4 rounded border-line accent-accent"
          />
          <span className="font-medium">Available only</span>
        </label>
        <p className="text-sm text-ink-muted">
          {total === 0
            ? "No products match these filters."
            : `${rangeStart}–${rangeEnd} of ${total}`}
        </p>
      </div>

      {items.length === 0 ? (
        <p className="text-ink-muted">
          {showAvailableOnly
            ? "No available products right now. Turn off Available only to see the full catalog."
            : "No products in the catalog yet."}
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((product) => (
            <li key={product.id}>
              <ProductCard
                id={product.id}
                name={product.name}
                imageUrl={product.imageUrl}
                wholesalePrice={product.wholesalePrice}
                currency={product.currency}
                available={product.available}
              />
            </li>
          ))}
        </ul>
      )}

      {pageCount > 1 ? (
        <nav
          aria-label="Catalog pages"
          className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6"
        >
          <p className="text-sm text-ink-muted">
            Page {page} of {pageCount}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => replaceParams({ page: page - 1 })}
              className="rounded-full border border-line bg-card px-4 py-2 text-sm font-medium text-ink hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= pageCount}
              onClick={() => replaceParams({ page: page + 1 })}
              className="rounded-full border border-line bg-card px-4 py-2 text-sm font-medium text-ink hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </nav>
      ) : null}
    </div>
  );
}
