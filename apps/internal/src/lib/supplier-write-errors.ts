import { isSuccessfulOrvalResponse } from "@dc-inventory/ui";

type WriteErrorBody = {
  error?: string;
};

export function supplierWriteErrorMessage(result: {
  status: number;
  data?: WriteErrorBody;
}): string {
  if (result.status === 409 && result.data?.error === "duplicate_vendor_number") {
    return "Another supplier already uses this vendor number.";
  }
  if (result.status === 409 && result.data?.error === "duplicate_po_prefix") {
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

export function throwIfSupplierWriteFailed(result: {
  status: number;
  data?: WriteErrorBody;
}): void {
  if (isSuccessfulOrvalResponse(result)) {
    return;
  }
  throw new Error(supplierWriteErrorMessage(result));
}
