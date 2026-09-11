import { isSuccessfulOrvalResponse, readOrvalHttpStatus } from "@dc-inventory/ui";

export const BILL_TO_LOAD_ERROR = "Could not load bill-to.";
export const SHIP_TOS_LOAD_ERROR = "Could not load ship-tos.";

export function orvalEnvelopeFailed(data: unknown): boolean {
  return data !== undefined && !isSuccessfulOrvalResponse(data);
}

export function orvalQueryFailed(query: { data: unknown; isError: boolean }): boolean {
  return query.isError || orvalEnvelopeFailed(query.data);
}

/**
 * DetailView `error` for a GET-by-id Orval query. Internal `customFetch` does
 * not throw on HTTP 500, so React Query `isError` stays false. 404 stays
 * unset so DetailView can render Not found; every other non-2xx is a load error.
 */
export function orvalDetailViewError(query: {
  data: unknown;
  isError: boolean;
  error?: unknown;
}): unknown {
  if (query.isError) {
    return query.error ?? "Failed to load.";
  }
  if (!orvalEnvelopeFailed(query.data)) {
    return undefined;
  }
  if (readOrvalHttpStatus(query.data) === 404) {
    return undefined;
  }
  return query.data;
}

/** GET bill-to returns 404 when the customer has no address yet. */
export function orvalBillToMissing(data: unknown): boolean {
  return readOrvalHttpStatus(data) === 404;
}

export function orvalBillToLoadFailed(query: { data: unknown; isError: boolean }): boolean {
  return orvalQueryFailed(query) && !orvalBillToMissing(query.data);
}
