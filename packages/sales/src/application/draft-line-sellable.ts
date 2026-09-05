import type { ProductSnapshot } from "../domain/ports/catalog-product.js";
import type { ConfirmSalesOrderShortage } from "./confirm-sales-order.js";

/** Locked available-to-sell cap for a draft line; open snapshots do not cap. */
export function lockedDraftShortage(
  product: ProductSnapshot,
  qty: number,
): ConfirmSalesOrderShortage | null {
  if (product.sellState !== "locked") {
    return null;
  }
  const availableQty = product.availableToSell ?? 0;
  if (availableQty > 0 && qty <= availableQty) {
    return null;
  }
  return {
    sku: product.sku.value,
    name: product.name,
    requestedQty: qty,
    availableQty,
  };
}

/** Cap only applies when requested qty is higher than what is already on the draft. */
export function lockedDraftIncreaseShortage(
  product: ProductSnapshot,
  requestedQty: number,
  alreadyOnDraft: number,
): ConfirmSalesOrderShortage | null {
  if (requestedQty <= alreadyOnDraft) {
    return null;
  }
  return lockedDraftShortage(product, requestedQty);
}
