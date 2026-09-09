type ActionErrorBody = {
  error?: string;
};

export function createPurchaseOrderErrorMessage(result: {
  status: number;
  data?: ActionErrorBody;
}): string {
  if (result.status === 409 && result.data?.error === "supplier_po_prefix_missing") {
    return "Set a PO prefix on this vendor before creating a purchase order.";
  }
  if (result.status === 404) {
    return "Could not create draft purchase order because the vendor was not found.";
  }
  return "Could not create draft purchase order.";
}

export function issuePurchaseOrderErrorMessage(result: {
  status: number;
  data?: ActionErrorBody;
}): string {
  if (result.status === 409) {
    return "This purchase order could not be issued due to a conflict.";
  }
  if (result.status === 400) {
    return "Issue request was invalid.";
  }
  if (result.status === 404) {
    return "Issue failed because the purchase order was not found.";
  }
  return "Issue failed.";
}

export function unissuePurchaseOrderErrorMessage(result: {
  status: number;
  data?: ActionErrorBody;
}): string {
  if (result.status === 409) {
    return "This purchase order could not be unissued because receiving has started.";
  }
  if (result.status === 404) {
    return "Unissue failed because the purchase order was not found.";
  }
  return "Unissue failed.";
}
