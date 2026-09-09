type ActionErrorBody = {
  error?: string;
  name?: string;
  sku?: string;
  requestedQty?: number;
  availableQty?: number;
};

function formatShortage(data: ActionErrorBody): string | null {
  if (data.availableQty === undefined || data.requestedQty === undefined) {
    return null;
  }
  const product = data.name?.trim() || data.sku?.trim();
  if (product === undefined || product.length === 0) {
    return null;
  }
  if (data.availableQty <= 0) {
    return `${product} is sold out. You asked for ${data.requestedQty}.`;
  }
  return `${product} has ${data.availableQty} available. You asked for ${data.requestedQty}.`;
}

export function replaceSalesOrderLinesErrorMessage(result: {
  status: number;
  data?: ActionErrorBody;
}): string {
  if (result.status === 409) {
    return "This draft could not be saved because the order is no longer editable.";
  }
  if (result.status === 400) {
    return "Autosave failed because one or more lines were invalid.";
  }
  if (result.status === 404) {
    return "Autosave failed because a catalog product was not found.";
  }
  return "Autosave failed.";
}

type CreditExceededBody = ActionErrorBody & {
  availableCreditCents?: number;
  orderTotalCents?: number;
};

function formatCreditExceeded(data: CreditExceededBody): string {
  if (data.availableCreditCents !== undefined && data.orderTotalCents !== undefined) {
    const available = (data.availableCreditCents / 100).toFixed(2);
    const total = (data.orderTotalCents / 100).toFixed(2);
    return `Available credit is $${available}; this order totals $${total}.`;
  }
  return "This order exceeds the customer's available credit.";
}

export function isCreditExceededConfirmError(result: {
  status: number;
  data?: ActionErrorBody;
}): boolean {
  return result.status === 409 && result.data?.error === "credit_exceeded";
}

export function confirmSalesOrderErrorMessage(result: {
  status: number;
  data?: ActionErrorBody;
}): string {
  if (result.status === 409 && result.data?.error === "credit_exceeded") {
    return formatCreditExceeded(result.data);
  }
  if (result.status === 409 && result.data?.error === "insufficient_atp") {
    return (
      formatShortage(result.data) ??
      "Insufficient available-to-sell inventory to confirm this order."
    );
  }
  if (result.status === 409) {
    return "This order could not be confirmed due to a conflict.";
  }
  if (result.status === 400) {
    return "Confirm request was invalid.";
  }
  if (result.status === 404) {
    return "Confirm failed because the order or ship-to was not found.";
  }
  return "Could not confirm this sales order.";
}

export function cancelSalesOrderErrorMessage(result: {
  status: number;
  data?: ActionErrorBody;
}): string {
  if (result.status === 409) {
    return "This order could not be cancelled due to a conflict.";
  }
  if (result.status === 404) {
    return "Cancel failed because the order was not found.";
  }
  return "Could not cancel this sales order.";
}

export function shipSalesOrderErrorMessage(result: {
  status: number;
  data?: ActionErrorBody;
}): string {
  if (result.status === 409) {
    return "This order could not be shipped due to a conflict.";
  }
  if (result.status === 400) {
    return "Ship request was invalid.";
  }
  if (result.status === 404) {
    return "Ship failed because the order was not found.";
  }
  return "Could not ship this sales order.";
}
