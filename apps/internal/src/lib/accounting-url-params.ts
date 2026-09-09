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
  tableUrlKeys,
  type TableUrlWriteOptions,
} from "./table-url-params";

export type AccountingPaymentRange = "today" | "mtd" | "custom";

export const ACCOUNTING_BALANCES_PATH = "/accounting";
export const ACCOUNTING_PAYMENTS_PATH = "/accounting/payments";

const VALID_BUCKETS = new Set<string>(AGING_BUCKET_KEYS);

export type AccountingSharedPatch = {
  asOf?: string | null;
  bucket?: AccountingAgingBucket | null;
  range?: AccountingPaymentRange | null;
  from?: string | null;
  to?: string | null;
};

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

export function monthStartIsoDate(isoDate: string): string {
  return `${isoDate.slice(0, 7)}-01`;
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

function writeTableParamsToRecord(
  meta: TableMeta,
  urlParams: ListQueryParams,
  target: SearchParamsRecord,
): void {
  for (const key of tableUrlKeys(meta)) {
    const value = urlParams[key];
    if (value === undefined || value === "") {
      delete target[key];
      continue;
    }
    if (Array.isArray(value)) {
      target[key] = value;
      continue;
    }
    target[key] = String(value);
  }
}

function pickSearchRecordForPath(
  targetPath: string,
  searchRecord: SearchParamsRecord,
): SearchParamsRecord {
  const meta =
    targetPath === ACCOUNTING_BALANCES_PATH
      ? listInternalAccountingCustomerBalancesTable
      : targetPath === ACCOUNTING_PAYMENTS_PATH
        ? listInternalAccountingPaymentsTable
        : null;
  if (!meta) {
    return {};
  }
  const allowed = new Set([
    ...tableUrlKeys(meta),
    ...(targetPath === ACCOUNTING_PAYMENTS_PATH ? ["range"] : []),
  ]);
  const picked: SearchParamsRecord = {};
  for (const key of allowed) {
    if (searchRecord[key] !== undefined) {
      picked[key] = searchRecord[key];
    }
  }
  return picked;
}

/** Canonical query keys for one accounting tab — never carries sibling-tab list state. */
export function accountingUrlParamsForPath(
  targetPath: string,
  searchRecord: SearchParamsRecord,
): SearchParamsRecord {
  const tabRecord = pickSearchRecordForPath(targetPath, searchRecord);
  const asOf = accountingAsOfFromSearchParams(searchRecord);
  const result: SearchParamsRecord = {};
  if (asOf !== todayIsoDate()) {
    result.asOf = asOf;
  }

  if (targetPath === ACCOUNTING_BALANCES_PATH) {
    const tableParams = listParamsFromSearchParams(
      listInternalAccountingCustomerBalancesTable,
      tabRecord,
    );
    writeTableParamsToRecord(
      listInternalAccountingCustomerBalancesTable,
      tableParamsForUrl(
        listInternalAccountingCustomerBalancesTable,
        tableParams,
      ),
      result,
    );
    const bucket = accountingBucketFromSearchParams(tabRecord);
    if (bucket) {
      result.bucket = bucket;
    }
    return result;
  }

  if (targetPath === ACCOUNTING_PAYMENTS_PATH) {
    const range = accountingPaymentRangeFromSearchParams(tabRecord);
    if (range !== "mtd") {
      result.range = range;
    }
    if (range === "custom") {
      const { from, to } = accountingPaymentDateRange(asOf, range, tabRecord);
      result.from = from;
      result.to = to;
    }
    const tableParams = listParamsFromSearchParams(
      listInternalAccountingPaymentsTable,
      tabRecord,
    );
    writeTableParamsToRecord(
      listInternalAccountingPaymentsTable,
      tableParamsForUrl(
        listInternalAccountingPaymentsTable,
        tableParams,
      ),
      result,
    );
    return result;
  }

  return result;
}

export function accountingTabHandoffParams(
  targetPath: string,
  searchRecord: SearchParamsRecord,
): SearchParamsRecord {
  const asOf = accountingAsOfFromSearchParams(searchRecord);
  const handoff: SearchParamsRecord = {};
  if (asOf !== todayIsoDate()) {
    handoff.asOf = asOf;
  }

  if (targetPath === ACCOUNTING_BALANCES_PATH) {
    const bucket = accountingBucketFromSearchParams(searchRecord);
    if (bucket) {
      handoff.bucket = bucket;
    }
    return handoff;
  }

  if (targetPath === ACCOUNTING_PAYMENTS_PATH) {
    const range = accountingPaymentRangeFromSearchParams(searchRecord);
    if (range !== "mtd") {
      handoff.range = range;
    }
    if (range === "custom") {
      const { from, to } = accountingPaymentDateRange(asOf, range, searchRecord);
      handoff.from = from;
      handoff.to = to;
    }
  }

  return handoff;
}

export function accountingSearchQueryString(
  targetPath: string,
  searchRecord: SearchParamsRecord,
  mode: "tab-handoff" | "current-tab" = "current-tab",
): string {
  const params =
    mode === "tab-handoff"
      ? accountingTabHandoffParams(targetPath, searchRecord)
      : accountingUrlParamsForPath(targetPath, searchRecord);
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") {
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== "") {
          search.append(key, item);
        }
      }
      continue;
    }
    search.set(key, value);
  }
  return search.toString();
}

export function accountingTabHref(
  targetPath: string,
  searchRecord: SearchParamsRecord,
): string {
  const query = accountingSearchQueryString(
    targetPath,
    searchRecord,
    "tab-handoff",
  );
  return query === "" ? targetPath : `${targetPath}?${query}`;
}

export function accountingPathWithQuery(
  pathname: string,
  searchRecord: SearchParamsRecord,
): string {
  const query = accountingSearchQueryString(pathname, searchRecord);
  return query === "" ? pathname : `${pathname}?${query}`;
}

export function applyAccountingSharedPatch(
  searchRecord: SearchParamsRecord,
  patch: AccountingSharedPatch,
  pathname: string,
): SearchParamsRecord {
  const merged: SearchParamsRecord = { ...searchRecord };

  if (patch.asOf !== undefined) {
    if (patch.asOf === null || patch.asOf === todayIsoDate()) {
      delete merged.asOf;
    } else {
      merged.asOf = patch.asOf;
    }
  }

  if (patch.bucket !== undefined) {
    if (patch.bucket === null) {
      delete merged.bucket;
    } else {
      merged.bucket = patch.bucket;
    }
  }

  if (patch.range !== undefined) {
    if (patch.range === null || patch.range === "mtd") {
      delete merged.range;
    } else {
      merged.range = patch.range;
    }
  }

  if (patch.from !== undefined) {
    if (patch.from === null) {
      delete merged.from;
    } else {
      merged.from = patch.from;
    }
  }

  if (patch.to !== undefined) {
    if (patch.to === null) {
      delete merged.to;
    } else {
      merged.to = patch.to;
    }
  }

  const asOf = accountingAsOfFromSearchParams(merged);
  const range = accountingPaymentRangeFromSearchParams(merged);
  if (patch.asOf !== undefined || patch.range !== undefined) {
    if (range === "custom") {
      const computed = accountingPaymentDateRange(asOf, range, merged);
      merged.from = firstValue(merged, "from") ?? computed.from;
      merged.to = firstValue(merged, "to") ?? computed.to;
    } else {
      delete merged.from;
      delete merged.to;
    }
  }

  return accountingUrlParamsForPath(pathname, merged);
}

export function applyAccountingTableParams(
  searchRecord: SearchParamsRecord,
  pathname: string,
  meta: TableMeta,
  params: ListQueryParams,
  options?: TableUrlWriteOptions,
): SearchParamsRecord {
  const merged: SearchParamsRecord = { ...searchRecord };
  for (const key of tableUrlKeys(meta)) {
    delete merged[key];
  }
  if (meta === listInternalAccountingCustomerBalancesTable) {
    delete merged.bucket;
  }
  if (meta === listInternalAccountingPaymentsTable) {
    delete merged.from;
    delete merged.to;
  }

  const urlParams = tableParamsForUrl(meta, params, options);
  for (const [key, value] of Object.entries(urlParams)) {
    if (value === undefined || value === "") {
      continue;
    }
    if (Array.isArray(value)) {
      merged[key] = value;
      continue;
    }
    merged[key] = String(value);
  }

  return accountingUrlParamsForPath(pathname, merged);
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

export function formatPastDuePercentLabel(percent: number): string {
  return `${percent}% of open AR`;
}

export function formatShareOfOpenArLabel(percent: number): string {
  return `${percent}% of open`;
}
