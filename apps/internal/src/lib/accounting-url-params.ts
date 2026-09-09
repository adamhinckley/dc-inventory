import {
  listInternalAccountingCustomerBalancesTable,
  listInternalAccountingPaymentsTable,
} from "@dc-inventory/api-client-internal";
import type { AccountingAgingBucket } from "./accounting-types";
import type { ListQueryParams, TableMeta } from "@dc-inventory/ui-internal";
import { AGING_BUCKET_KEYS, todayIsoDate } from "./customer-accounting-format";
import {
  listParamsFromSearchParams,
  type SearchParamsRecord,
  tableParamsForUrl,
  tableSearchFromParams,
  type TableUrlWriteOptions,
} from "./table-url-params";

export type AccountingPaymentRange = "today" | "mtd" | "custom";

export const ACCOUNTING_SHARED_URL_KEYS = ["asOf", "bucket", "range"] as const;

const VALID_BUCKETS = new Set<string>(AGING_BUCKET_KEYS);

export function accountingTabHref(path: string, search: string): string {
  return search === "" ? path : `${path}?${search}`;
}

export function monthStartIsoDate(isoDate: string): string {
  return `${isoDate.slice(0, 7)}-01`;
}

function firstValue(
  searchParams: SearchParamsRecord,
  key: string,
): string | undefined {
  const value = searchParams[key];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export function accountingAsOfFromSearchParams(
  searchParams: SearchParamsRecord,
): string {
  return firstValue(searchParams, "asOf") ?? todayIsoDate();
}

export function accountingBucketFromSearchParams(
  searchParams: SearchParamsRecord,
): AccountingAgingBucket | undefined {
  const raw = firstValue(searchParams, "bucket");
  if (raw && VALID_BUCKETS.has(raw)) {
    return raw as AccountingAgingBucket;
  }
  return undefined;
}

export function accountingPaymentRangeFromSearchParams(
  searchParams: SearchParamsRecord,
): AccountingPaymentRange {
  const raw = firstValue(searchParams, "range");
  if (raw === "today" || raw === "mtd" || raw === "custom") {
    return raw;
  }
  return "mtd";
}

export function accountingPaymentDateRange(
  asOf: string,
  range: AccountingPaymentRange,
  searchParams: SearchParamsRecord,
): { from: string; to: string } {
  if (range === "today") {
    return { from: asOf, to: asOf };
  }
  if (range === "mtd") {
    return { from: monthStartIsoDate(asOf), to: asOf };
  }
  const from = firstValue(searchParams, "from") ?? monthStartIsoDate(asOf);
  const to = firstValue(searchParams, "to") ?? asOf;
  return { from, to };
}

export function accountingBalancesInitialParams(
  searchParams: SearchParamsRecord,
): ListQueryParams {
  const asOf = accountingAsOfFromSearchParams(searchParams);
  const params = listParamsFromSearchParams(
    listInternalAccountingCustomerBalancesTable,
    searchParams,
  );
  return {
    ...params,
    asOf,
  };
}

export function accountingPaymentsInitialParams(
  searchParams: SearchParamsRecord,
): ListQueryParams {
  const asOf = accountingAsOfFromSearchParams(searchParams);
  const range = accountingPaymentRangeFromSearchParams(searchParams);
  const { from, to } = accountingPaymentDateRange(asOf, range, searchParams);
  const params = listParamsFromSearchParams(
    listInternalAccountingPaymentsTable,
    searchParams,
  );
  return {
    ...params,
    from,
    to,
  };
}

function readSharedAccountingParams(search: URLSearchParams): URLSearchParams {
  const preserved = new URLSearchParams();
  for (const key of ACCOUNTING_SHARED_URL_KEYS) {
    const value = search.get(key);
    if (value) {
      preserved.set(key, value);
    }
  }
  return preserved;
}

function normalizeAccountingSharedParams(search: URLSearchParams): void {
  const today = todayIsoDate();
  if (search.get("asOf") === today) {
    search.delete("asOf");
  }
  if (search.get("range") === "mtd" || !search.get("range")) {
    search.delete("range");
  }
}

/**
 * Like `replaceTableUrlParams`, but keeps accounting-wide keys (`asOf`, `bucket`, `range`)
 * when a tab table rewrites list params.
 */
export function replaceAccountingTableUrlParams(
  meta: TableMeta,
  params: ListQueryParams,
  options?: TableUrlWriteOptions,
): void {
  if (typeof window === "undefined") {
    return;
  }
  const shared = readSharedAccountingParams(
    new URLSearchParams(window.location.search),
  );
  const nextQuery = tableSearchFromParams(
    meta,
    tableParamsForUrl(meta, params, options),
    window.location.search,
  );
  const next = new URLSearchParams(
    nextQuery.startsWith("?") ? nextQuery.slice(1) : nextQuery,
  );
  for (const key of shared.keys()) {
    if (!next.has(key)) {
      next.set(key, shared.get(key)!);
    }
  }
  normalizeAccountingSharedParams(next);
  const query = next.toString();
  const target = `${window.location.pathname}${query === "" ? "" : `?${query}`}${window.location.hash}`;
  const currentTarget = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (target === currentTarget) {
    return;
  }
  window.history.replaceState(window.history.state, "", target);
}

export function replaceAccountingSharedParams(
  patch: Partial<
    Record<(typeof ACCOUNTING_SHARED_URL_KEYS)[number], string | null>
  >,
): void {
  if (typeof window === "undefined") {
    return;
  }
  const next = new URLSearchParams(window.location.search);
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === "") {
      next.delete(key);
      continue;
    }
    next.set(key, value);
  }

  const asOf = next.get("asOf") ?? todayIsoDate();
  const range = accountingPaymentRangeFromSearchParams(
    Object.fromEntries(next.entries()),
  );
  if (range === "today") {
    next.set("from", asOf);
    next.set("to", asOf);
  } else if (range === "mtd") {
    next.delete("from");
    next.delete("to");
  }

  normalizeAccountingSharedParams(next);
  const query = next.toString();
  const target = `${window.location.pathname}${query === "" ? "" : `?${query}`}${window.location.hash}`;
  window.history.replaceState(window.history.state, "", target);
}

export function formatPastDuePercentLabel(percent: number): string {
  return `${percent}% of open AR`;
}

export function formatShareOfOpenArLabel(percent: number): string {
  return `${percent}% of open`;
}
