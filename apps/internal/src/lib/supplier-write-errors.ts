import { isSuccessfulOrvalResponse } from "@dc-inventory/ui";

type WriteResult = {
  status: number;
  /** Orval unions the 2xx body with the error bodies, so read `error` structurally. */
  data?: unknown;
};

function errorCode(data: unknown): string | undefined {
  if (typeof data !== "object" || data === null || !("error" in data)) {
    return undefined;
  }
  const { error } = data as { error?: unknown };
  return typeof error === "string" ? error : undefined;
}

export function supplierWriteErrorMessage(result: WriteResult): string {
  const code = errorCode(result.data);
  if (result.status === 409 && code === "duplicate_vendor_number") {
    return "Another supplier already uses this vendor number.";
  }
  if (result.status === 409 && code === "duplicate_po_prefix") {
    return "Another supplier already uses this PO prefix.";
  }
  if (result.status === 400) {
    return "This supplier could not be saved because the request was invalid.";
  }
  if (result.status === 404) {
    return "This supplier was not found.";
  }
  return "Could not save this supplier.";
}

export function throwIfSupplierWriteFailed(result: WriteResult): void {
  if (isSuccessfulOrvalResponse(result)) {
    return;
  }
  throw new Error(supplierWriteErrorMessage(result));
}
