import type { PurchaseOrderLineDraft } from "./purchase-order-types";

/**
 * A picker click becomes a draft line at qty 1. The table owns quantity
 * after that — the combobox does not stage SKUs.
 */
export function draftLineFromVendorProduct(product: {
  sku: string;
  catalogName: string;
}): PurchaseOrderLineDraft {
  return {
    id: crypto.randomUUID(),
    sku: product.sku,
    name: product.catalogName,
    qty: 1,
  };
}
