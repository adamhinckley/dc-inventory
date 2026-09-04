export type CatalogBrowseParams = {
  page?: number;
  pageSize?: number;
  sortBy?: "name" | "available";
  sortOrder?: "asc" | "desc";
  availableOnly?: boolean;
};

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 25;

function parsePositiveInt(value: string | null, fallback: number): number {
  if (value === null) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : fallback;
}

export function parseCatalogListParams(
  searchParams: URLSearchParams,
): CatalogBrowseParams {
  const availableOnlyRaw = searchParams.get("availableOnly");

  return {
    page: parsePositiveInt(searchParams.get("page"), DEFAULT_PAGE),
    pageSize: DEFAULT_PAGE_SIZE,
    sortBy: "name",
    sortOrder: "asc",
    availableOnly:
      availableOnlyRaw === null ? true : availableOnlyRaw !== "false",
  };
}

/** Always send availableOnly to the API so the shop default is explicit server-side. */
export function wholesaleCatalogRequestParams(
  params: CatalogBrowseParams,
): CatalogBrowseParams {
  return {
    ...params,
    availableOnly: params.availableOnly !== false,
  };
}

export function buildCatalogListSearchParams(
  params: CatalogBrowseParams,
): string {
  const next = new URLSearchParams();

  if (params.page !== undefined && params.page > DEFAULT_PAGE) {
    next.set("page", String(params.page));
  }
  if (params.availableOnly === false) {
    next.set("availableOnly", "false");
  }

  return next.toString();
}

export function catalogListPageCount(total: number, pageSize: number): number {
  if (total <= 0) {
    return 1;
  }
  return Math.ceil(total / pageSize);
}
