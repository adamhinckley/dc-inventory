"use client";

import { useListWholesaleCatalog } from "@dc-inventory/api-client-wholesale";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildCatalogListSearchParams,
  CATALOG_PAGE_SIZES,
  CATALOG_SORT_OPTIONS,
  catalogListPageCount,
  catalogSortKey,
  changeCatalogListParams,
  paginationItems,
  parseCatalogListParams,
  sortKeyToParams,
  wholesaleCatalogRequestParams,
  type CatalogBrowseParams,
  type CatalogPageSize,
  type CatalogSortKey,
} from "../lib/catalog-list-params";
import { CatalogFilters } from "./catalog-filters";
import { ProductCard } from "./product-card";

const GRID_CLASS =
  "grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6";

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        d="M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15Zm10.5 3-5-5"
      />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        d="M4 6h16M7 12h10M10 18h4"
      />
    </svg>
  );
}

function SkeletonGrid({ count }: { count: number }) {
  return (
    <ul className={GRID_CLASS} aria-busy="true" aria-label="Loading products">
      {Array.from({ length: count }, (_, index) => (
        <li key={index} className="flex flex-col gap-2">
          <div className="shop-skeleton aspect-square rounded-xl" />
          <div className="shop-skeleton mt-1 h-3 w-1/3 rounded" />
          <div className="shop-skeleton h-4 w-5/6 rounded" />
          <div className="shop-skeleton h-4 w-1/4 rounded" />
        </li>
      ))}
    </ul>
  );
}

function SearchField({
  value,
  onSubmit,
}: {
  value: string;
  onSubmit: (next: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <form
      role="search"
      className="relative"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(draft);
      }}
    >
      <label htmlFor="catalog-search" className="sr-only">
        Search products
      </label>
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink-muted">
        <SearchIcon />
      </span>
      <input
        id="catalog-search"
        type="text"
        placeholder="Search name or item #"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        className="shop-input min-h-10 w-60 pl-9 pr-8 text-sm"
      />
      {draft.length > 0 ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            setDraft("");
            onSubmit("");
          }}
          className="absolute inset-y-0 right-2 flex cursor-pointer items-center text-ink-muted hover:text-ink"
        >
          ×
        </button>
      ) : null}
    </form>
  );
}

function Pagination({
  page,
  pageCount,
  onPage,
}: {
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
}) {
  if (pageCount <= 1) {
    return null;
  }
  const buttonClass = (active: boolean) =>
    `inline-flex size-10 items-center justify-center rounded-full text-sm tabular-nums transition-colors ${
      active
        ? "bg-ink font-semibold text-canvas"
        : "cursor-pointer text-ink hover:bg-canvas-muted"
    }`;
  return (
    <nav aria-label="Catalog pages" className="flex items-center justify-center gap-1 pt-4">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        aria-label="Previous page"
        className="inline-flex size-10 cursor-pointer items-center justify-center rounded-full text-ink hover:bg-canvas-muted disabled:cursor-not-allowed disabled:opacity-30"
      >
        ‹
      </button>
      {paginationItems(page, pageCount).map((item, index) =>
        item === null ? (
          <span key={`gap-${index}`} className="px-1 text-ink-muted">
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            aria-current={item === page ? "page" : undefined}
            onClick={() => onPage(item)}
            className={buttonClass(item === page)}
          >
            {item}
          </button>
        ),
      )}
      <button
        type="button"
        disabled={page >= pageCount}
        onClick={() => onPage(page + 1)}
        aria-label="Next page"
        className="inline-flex size-10 cursor-pointer items-center justify-center rounded-full text-ink hover:bg-canvas-muted disabled:cursor-not-allowed disabled:opacity-30"
      >
        ›
      </button>
    </nav>
  );
}

/**
 * Shopify "collection" layout: filter sidebar on lg+, a Filter drawer below that,
 * a page breadcrumb, sticky toolbar (count, search, sort, per page) and a dense grid.
 */
export function ProductCardList() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = useMemo(() => parseCatalogListParams(searchParams), [searchParams]);
  const requestParams = useMemo(() => wholesaleCatalogRequestParams(params), [params]);
  const catalog = useListWholesaleCatalog(requestParams);
  const filterDialogRef = useRef<HTMLDialogElement>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    const dialog = filterDialogRef.current;
    if (dialog === null) {
      return;
    }
    if (filtersOpen && !dialog.open) {
      dialog.showModal();
    } else if (!filtersOpen && dialog.open) {
      dialog.close();
    }
  }, [filtersOpen]);

  const replaceParams = useCallback(
    (patch: Partial<CatalogBrowseParams>) => {
      const merged = changeCatalogListParams(params, patch);
      const query = buildCatalogListSearchParams(merged);
      router.replace(query.length > 0 ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  const goToPage = useCallback(
    (page: number) => {
      const query = buildCatalogListSearchParams(changeCatalogListParams(params, { page }));
      router.push(query.length > 0 ? `${pathname}?${query}` : pathname);
    },
    [params, pathname, router],
  );

  const payload = catalog.data?.data;
  const loaded = payload !== undefined && "items" in payload ? payload : undefined;
  const total = loaded?.total ?? 0;
  const pageSize = params.pageSize ?? 48;
  const page = loaded?.page ?? params.page ?? 1;
  const pageCount = catalogListPageCount(total, loaded?.pageSize ?? pageSize);
  const category = params.category;
  const q = params.q ?? "";
  const inStockOnly = params.inStockOnly !== false;
  const preOrder = params.preOrder !== false;
  const activeFilterCount =
    (category !== undefined ? 1 : 0) +
    (params.inStockOnly === false ? 1 : 0) +
    (params.preOrder === false ? 1 : 0);

  const toolbar = (
    <div className="shop-toolbar -mx-6 border-b border-line px-6 py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <p className="min-w-0 flex-1 text-xs text-ink-muted">
          {catalog.isPending
            ? "Loading…"
            : `${total.toLocaleString()} ${total === 1 ? "product" : "products"}${
                q.length > 0 ? ` for “${q}”` : ""
              }`}
        </p>
        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border border-line-strong bg-card px-4 text-sm font-semibold text-ink hover:border-accent hover:text-accent lg:hidden"
        >
          <FilterIcon />
          Filter
          {activeFilterCount > 0 ? (
            <span className="rounded-full bg-accent px-1.5 text-[0.6875rem] text-on-accent">
              {activeFilterCount}
            </span>
          ) : null}
        </button>
        <SearchField value={q} onSubmit={(next) => replaceParams({ q: next })} />
        <label className="flex items-center gap-2 text-sm text-ink-muted">
          <span className="hidden sm:inline">Sort</span>
          <select
            aria-label="Sort by"
            value={catalogSortKey(params)}
            onChange={(event) =>
              replaceParams(sortKeyToParams(event.target.value as CatalogSortKey))
            }
            className="shop-input min-h-10 w-auto cursor-pointer py-0 pr-8 text-sm font-semibold text-ink"
          >
            {CATALOG_SORT_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-ink-muted">
          <span className="hidden sm:inline">Show</span>
          <select
            aria-label="Products per page"
            value={pageSize}
            onChange={(event) =>
              replaceParams({ pageSize: Number(event.target.value) as CatalogPageSize })
            }
            className="shop-input min-h-10 w-auto cursor-pointer py-0 pr-8 text-sm font-semibold text-ink"
          >
            {CATALOG_PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );

  let body: React.ReactNode;
  if (catalog.isPending) {
    body = <SkeletonGrid count={Math.min(pageSize, 24)} />;
  } else if (catalog.isError || loaded === undefined) {
    body = (
      <p className="text-sold-out" role="alert">
        Catalog is unavailable. Start the API with `pnpm dev:api` and reload.
      </p>
    );
  } else if (loaded.items.length === 0) {
    const emptyAvailabilityMessage =
      inStockOnly && preOrder
        ? "Nothing in stock or available for pre-order right now. Adjust your filters to see more."
        : inStockOnly
          ? "Nothing in stock right now. Turn on Pre-order to include open items."
          : preOrder
            ? "Nothing available for pre-order right now. Turn on In stock only to include warehouse-ready items."
            : "No products in this view yet.";
    const hasAvailabilityFilter = inStockOnly || preOrder;

    body = (
      <div className="flex flex-col items-start gap-4 rounded-2xl border border-line bg-card p-8">
        <p className="text-ink-muted">
          {q.length > 0
            ? `Nothing matches “${q}”${category !== undefined ? ` in ${category}` : ""}.`
            : emptyAvailabilityMessage}
        </p>
        <div className="flex flex-wrap gap-2">
          {q.length > 0 ? (
            <button
              type="button"
              onClick={() => replaceParams({ q: undefined })}
              className="shop-button-secondary inline-flex min-h-10 cursor-pointer items-center px-4 text-sm"
            >
              Clear search
            </button>
          ) : null}
          {category !== undefined ? (
            <Link
              href="/products"
              className="shop-button-secondary inline-flex min-h-10 items-center px-4 text-sm"
            >
              All products
            </Link>
          ) : null}
          {q.length === 0 && inStockOnly && !preOrder ? (
            <button
              type="button"
              onClick={() => replaceParams({ preOrder: true })}
              className="shop-button-secondary inline-flex min-h-10 cursor-pointer items-center px-4 text-sm"
            >
              Include pre-order
            </button>
          ) : null}
          {q.length === 0 && !inStockOnly && preOrder ? (
            <button
              type="button"
              onClick={() => replaceParams({ inStockOnly: true })}
              className="shop-button-secondary inline-flex min-h-10 cursor-pointer items-center px-4 text-sm"
            >
              Include in-stock items
            </button>
          ) : null}
          {q.length === 0 && hasAvailabilityFilter ? (
            <button
              type="button"
              onClick={() => replaceParams({ inStockOnly: false, preOrder: false })}
              className="shop-button-secondary inline-flex min-h-10 cursor-pointer items-center px-4 text-sm"
            >
              Show everything
            </button>
          ) : null}
        </div>
      </div>
    );
  } else {
    body = (
      <>
        <ul className={GRID_CLASS}>
          {loaded.items.map((product) => (
            <li key={product.id}>
              <ProductCard
                id={product.id}
                sku={product.sku}
                name={product.name}
                imageUrl={product.imageUrl}
                wholesalePrice={product.wholesalePrice}
                currency={product.currency}
                available={product.available}
                availableToSell={product.availableToSell}
                sellState={product.sellState}
                fromCategory={category}
              />
            </li>
          ))}
        </ul>
        <Pagination page={page} pageCount={pageCount} onPage={goToPage} />
      </>
    );
  }

  return (
    <section className="flex flex-col gap-6">
      <h1 className="sr-only">{category ?? "Products"}</h1>
      <nav aria-label="Breadcrumb" className="text-sm text-ink-muted">
        {category === undefined ? (
          <span className="text-ink">Products</span>
        ) : (
          <>
            <button
              type="button"
              onClick={() => replaceParams({ category: undefined })}
              className="cursor-pointer hover:text-accent"
            >
              Products
            </button>
            <span className="mx-2">/</span>
            <span className="text-ink">{category}</span>
          </>
        )}
      </nav>
    <div className="lg:grid lg:grid-cols-[16rem_1fr] lg:gap-10">
      <aside className="hidden lg:block lg:self-start">
        <div className="sticky top-[calc(var(--space-nav-height)+1.5rem)] flex max-h-[calc(100dvh-var(--space-nav-height)-4rem)] flex-col overflow-hidden">
          <CatalogFilters params={params} onChange={replaceParams} idPrefix="sidebar" />
        </div>
      </aside>
      <div className="flex min-w-0 flex-col gap-6">
        {toolbar}
        {body}
      </div>

      <dialog
        ref={filterDialogRef}
        aria-label="Filters"
        className="shop-drawer shop-drawer-left lg:hidden"
        onClose={() => setFiltersOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            setFiltersOpen(false);
          }
        }}
      >
        <div className="flex h-full flex-col">
          <header className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="font-display text-2xl font-semibold text-ink">Filters</h2>
            <button
              type="button"
              onClick={() => setFiltersOpen(false)}
              aria-label="Close filters"
              className="inline-flex size-10 cursor-pointer items-center justify-center rounded-full border border-line text-ink hover:bg-canvas"
            >
              ×
            </button>
          </header>
          <div className="flex-1 overflow-y-auto px-5 py-5">
            <CatalogFilters
              params={params}
              onChange={(patch) => {
                replaceParams(patch);
              }}
              idPrefix="drawer"
            />
          </div>
          <footer className="border-t border-line px-5 py-4">
            <button
              type="button"
              onClick={() => setFiltersOpen(false)}
              className="shop-button-primary w-full cursor-pointer text-sm"
            >
              {catalog.isPending ? "Show products" : `Show ${total.toLocaleString()} products`}
            </button>
          </footer>
        </div>
      </dialog>
    </div>
    </section>
  );
}
