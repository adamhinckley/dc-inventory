import { shopAvailabilityLabel as catalogShopAvailabilityLabel } from "@dc-inventory/catalog";
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

export function shopAvailabilityLabel(input: ShopAvailabilityInput): {
  inStock: boolean;
  label: string;
} {
  return catalogShopAvailabilityLabel(input);
}
