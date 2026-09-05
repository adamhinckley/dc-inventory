export const SHIP_TOS_EMPTY_MESSAGE = "No ship-to addresses yet.";

export const SHIP_TOS_DESCRIPTION =
  "Delivery addresses for this customer.";

export const BILL_TO_EMPTY_PREFIX = "No bill-to address yet.";

export const BILL_TO_EMPTY_WITH_DEFAULT_SHIP_TO_COPY =
  " Add one manually or copy from the default ship-to.";

export const BILL_TO_EMPTY_SHIP_REFUSES_COPY =
  " Shipping will refuse until a bill-to exists.";

export function billToEmptyMessage(hasDefaultShipTo: boolean): string {
  if (hasDefaultShipTo) {
    return `${BILL_TO_EMPTY_PREFIX}${BILL_TO_EMPTY_WITH_DEFAULT_SHIP_TO_COPY}`;
  }
  return `${BILL_TO_EMPTY_PREFIX}${BILL_TO_EMPTY_SHIP_REFUSES_COPY}`;
}
