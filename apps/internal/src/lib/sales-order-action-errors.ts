type ActionErrorBody = {
  error?: string;
};

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

export function confirmSalesOrderErrorMessage(result: {
  status: number;
  data?: ActionErrorBody;
}): string {
  if (result.status === 409 && result.data?.error === "insufficient_atp") {
    return "Insufficient available-to-sell inventory to confirm this order.";
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
