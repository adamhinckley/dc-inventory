import type { listWholesaleCatalog } from "@dc-inventory/api-client-wholesale";

export type ShopSellState = Extract<
  Awaited<ReturnType<typeof listWholesaleCatalog>>,
  { status: 200 }
>["data"]["items"][number]["sellState"];

type ShopAvailabilityInput = {
  available: number;
  availableToSell: number | null;
  sellState: ShopSellState;
};

/** Qty to show on wholesale cards; mirrors catalog shopDisplayAvailableQty / isShopSellable. */
export function shopDisplayAvailableQty(input: ShopAvailabilityInput): number | null {
  if (input.sellState === "locked") {
    return input.availableToSell !== null && input.availableToSell > 0
      ? input.availableToSell
      : null;
  }
  return input.available > 0 ? input.available : null;
}

/** Label qty for wholesale cards; mirrors catalog isShopSellable / shopDisplayAvailableQty. */
export function shopAvailabilityLabel(input: ShopAvailabilityInput): {
  inStock: boolean;
  label: string;
} {
  const qty = shopDisplayAvailableQty(input);
  if (qty === null) {
    return { inStock: false, label: "Unavailable" };
  }
  return { inStock: true, label: `${qty.toLocaleString()} available` };
}
