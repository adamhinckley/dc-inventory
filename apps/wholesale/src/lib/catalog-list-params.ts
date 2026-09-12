export type CatalogSortBy = "name" | "available";
export type CatalogSortOrder = "asc" | "desc";

export type CatalogBrowseParams = {
  q?: string;
  category?: string;
  page?: number;
  pageSize?: number;
  sortBy?: CatalogSortBy;
  sortOrder?: CatalogSortOrder;
  inStockOnly?: boolean;
  preOrder?: boolean;
};

export const DEFAULT_PAGE = 1;
/** Dense 6-across grid: 48 fills eight rows. API max is 100. */
export const DEFAULT_PAGE_SIZE = 48;
export const CATALOG_PAGE_SIZES = [24, 48, 96] as const;
export type CatalogPageSize = (typeof CATALOG_PAGE_SIZES)[number];

/** One select value per sort so the toolbar reads like Shopify's "Sort by". */
export type CatalogSortKey = "name-asc" | "name-desc" | "available-desc";

export const CATALOG_SORT_OPTIONS: ReadonlyArray<{ key: CatalogSortKey; label: string }> = [
  { key: "name-asc", label: "Name, A–Z" },
  { key: "name-desc", label: "Name, Z–A" },
  { key: "available-desc", label: "Availability" },
];

const DEFAULT_SORT: CatalogSortKey = "name-asc";

function parsePositiveInt(value: string | null, fallback: number): number {
  if (value === null) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : fallback;
}

function parsePageSize(value: string | null): CatalogPageSize {
  const parsed = parsePositiveInt(value, DEFAULT_PAGE_SIZE);
  return (CATALOG_PAGE_SIZES as readonly number[]).includes(parsed)
    ? (parsed as CatalogPageSize)
    : DEFAULT_PAGE_SIZE;
}

function parseSortKey(value: string | null): CatalogSortKey {
  return CATALOG_SORT_OPTIONS.some((option) => option.key === value)
    ? (value as CatalogSortKey)
    : DEFAULT_SORT;
}

export function sortKeyToParams(key: CatalogSortKey): {
  sortBy: CatalogSortBy;
  sortOrder: CatalogSortOrder;
} {
  switch (key) {
    case "name-desc":
      return { sortBy: "name", sortOrder: "desc" };
    case "available-desc":
      return { sortBy: "available", sortOrder: "desc" };
    default:
      return { sortBy: "name", sortOrder: "asc" };
  }
}

export function catalogSortKey(params: Pick<CatalogBrowseParams, "sortBy" | "sortOrder">): CatalogSortKey {
  if (params.sortBy === "available") {
    return "available-desc";
  }
  return params.sortOrder === "desc" ? "name-desc" : "name-asc";
}

function cleanText(value: string | null): string | undefined {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseAvailabilityToggle(searchParams: URLSearchParams, key: "inStockOnly" | "preOrder"): boolean {
  const raw = searchParams.get(key);
  return raw === null ? true : raw !== "false";
}

export function parseCatalogListParams(searchParams: URLSearchParams): CatalogBrowseParams {
  const q = cleanText(searchParams.get("q"));
  const category = cleanText(searchParams.get("category"));

  return {
    ...(q !== undefined ? { q } : {}),
    ...(category !== undefined ? { category } : {}),
    page: parsePositiveInt(searchParams.get("page"), DEFAULT_PAGE),
    pageSize: parsePageSize(searchParams.get("pageSize")),
    ...sortKeyToParams(parseSortKey(searchParams.get("sort"))),
    inStockOnly: parseAvailabilityToggle(searchParams, "inStockOnly"),
    preOrder: parseAvailabilityToggle(searchParams, "preOrder"),
  };
}

/** Always send availability toggles to the API so the shop default is explicit server-side. */
export function wholesaleCatalogRequestParams(params: CatalogBrowseParams): CatalogBrowseParams {
  return {
    ...params,
    inStockOnly: params.inStockOnly !== false,
    preOrder: params.preOrder !== false,
  };
}

/**
 * Anything that changes *which* products match (search, category, size, sort,
 * availability) sends the buyer back to page 1; only `page` itself keeps the page.
 */
export function changeCatalogListParams(
  current: CatalogBrowseParams,
  patch: Partial<CatalogBrowseParams>,
): CatalogBrowseParams {
  const next: CatalogBrowseParams = { ...current, ...patch };
  const filterChanged = (Object.keys(patch) as Array<keyof CatalogBrowseParams>).some(
    (key) => key !== "page" && patch[key] !== current[key],
  );
  if (filterChanged && patch.page === undefined) {
    next.page = DEFAULT_PAGE;
  }
  if (next.q !== undefined && next.q.trim().length === 0) {
    delete next.q;
  }
  if (next.category !== undefined && next.category.trim().length === 0) {
    delete next.category;
  }
  return next;
}

export function buildCatalogListSearchParams(params: CatalogBrowseParams): string {
  const next = new URLSearchParams();

  if (params.q !== undefined && params.q.trim().length > 0) {
    next.set("q", params.q.trim());
  }
  if (params.category !== undefined && params.category.trim().length > 0) {
    next.set("category", params.category.trim());
  }
  const sort = catalogSortKey(params);
  if (sort !== DEFAULT_SORT) {
    next.set("sort", sort);
  }
  if (params.pageSize !== undefined && params.pageSize !== DEFAULT_PAGE_SIZE) {
    next.set("pageSize", String(params.pageSize));
  }
  if (params.page !== undefined && params.page > DEFAULT_PAGE) {
    next.set("page", String(params.page));
  }
  if (params.inStockOnly === false) {
    next.set("inStockOnly", "false");
  }
  if (params.preOrder === false) {
    next.set("preOrder", "false");
  }

  return next.toString();
}

export function catalogListPageCount(total: number, pageSize: number): number {
  if (total <= 0) {
    return 1;
  }
  return Math.ceil(total / pageSize);
}

/**
 * Shopify-style numbered pagination: first, last, current ±1, `null` for gaps.
 * `1 … 4 5 6 … 12`. Small page counts list every page.
 */
export function paginationItems(page: number, pageCount: number): Array<number | null> {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }
  const pages = new Set<number>([1, pageCount]);
  for (let candidate = page - 1; candidate <= page + 1; candidate += 1) {
    if (candidate >= 1 && candidate <= pageCount) {
      pages.add(candidate);
    }
  }
  if (page <= 3) {
    [2, 3, 4].forEach((candidate) => pages.add(candidate));
  }
  if (page >= pageCount - 2) {
    [pageCount - 3, pageCount - 2, pageCount - 1].forEach((candidate) => pages.add(candidate));
  }
  const sorted = [...pages].sort((left, right) => left - right);
  const items: Array<number | null> = [];
  for (const [index, value] of sorted.entries()) {
    const previous = sorted[index - 1];
    if (previous !== undefined && value - previous > 1) {
      items.push(null);
    }
    items.push(value);
  }
  return items;
}
