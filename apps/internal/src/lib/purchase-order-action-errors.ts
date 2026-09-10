type ActionErrorBody = {
  error?: string;
  sku?: string;
  name?: string;
};

function purchaseOrderProductLabel(data: ActionErrorBody): string | null {
  const product = data.name?.trim() || data.sku?.trim();
  if (product === undefined || product.length === 0) {
    return null;
  }
  return product;
}

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
  if (result.status === 409 && result.data?.error === "illegal_transition") {
    return "This purchase order is not a draft, so it cannot be issued.";
  }
  if (result.status === 409 && result.data?.error === "product_not_found") {
    return "A product on this purchase order is missing from the catalog.";
  }
  if (result.status === 409 && result.data?.error === "provenance_conflict") {
    const product = result.data !== undefined ? purchaseOrderProductLabel(result.data) : null;
    if (product !== null) {
      return `${product} already has inbound from a previous issue of this purchase order. Create a new PO to issue these lines again.`;
    }
    return "Inbound was already recorded when this purchase order was issued earlier. Create a new PO to issue these lines again.";
  }
  if (result.status === 409 && result.data?.error === "invalid_quantity") {
    const product = result.data !== undefined ? purchaseOrderProductLabel(result.data) : null;
    if (product !== null) {
      return `${product} has an invalid quantity and cannot be issued.`;
    }
    return "A line on this purchase order has an invalid quantity and cannot be issued.";
  }
  if (result.status === 409 && result.data?.error === "inventory_conflict") {
    return "Inventory could not record inbound for this purchase order. Refresh and try again.";
  }
  if (result.status === 409 && result.data?.error === "idempotency_conflict") {
    return "This issue request conflicts with a previous attempt. Refresh and try again.";
  }
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
