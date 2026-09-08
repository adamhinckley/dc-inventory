import type { ProductSnapshot } from "../domain/ports/catalog-product.js";
import type { ConfirmSalesOrderShortage } from "./confirm-sales-order.js";
import {
  computeEffectiveSellState,
  type DemandPersistedState,
} from "@dc-inventory/inventory";

function sellWindowDemandState(product: ProductSnapshot): DemandPersistedState {
  return Object.freeze({
    committed: 0,
    stickyLocked: product.stickyLocked ?? false,
    windowOpensAt: product.windowOpensAt ?? null,
    windowClosesAt: product.windowClosesAt ?? null,
  });
}

function effectiveSellStateOptions(
  product: ProductSnapshot,
): { hasActiveSellWindowMembership: boolean } | undefined {
  if (product.hasActiveSellWindowMembership === undefined) {
    return undefined;
  }
  return { hasActiveSellWindowMembership: product.hasActiveSellWindowMembership };
}

/** Post-close sticky lock or closed window without an active SellWindow membership. */
export function isPostCloseCartFrozen(product: ProductSnapshot, now: Date): boolean {
  if (product.sellState !== "locked") {
    return false;
  }
  const demand = sellWindowDemandState(product);
  if (demand.windowOpensAt === null && demand.windowClosesAt === null) {
    return false;
  }
  const windowOpensAt = demand.windowOpensAt;
  if (windowOpensAt !== null && now < windowOpensAt) {
    return false;
  }
  return (
    computeEffectiveSellState(demand, now, effectiveSellStateOptions(product)) === "locked"
  );
}

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
  now: Date = new Date(),
): ConfirmSalesOrderShortage | null {
  if (requestedQty <= alreadyOnDraft) {
    return null;
  }
  if (isPostCloseCartFrozen(product, now)) {
    return {
      sku: product.sku.value,
      name: product.name,
      requestedQty,
      availableQty: alreadyOnDraft,
    };
  }
  return lockedDraftShortage(product, requestedQty);
}
