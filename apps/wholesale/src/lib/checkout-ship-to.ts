export type CheckoutShipToChoice = {
  id: string;
  isDefault?: boolean;
};

export function initialCheckoutShipToId(
  items: readonly CheckoutShipToChoice[],
): string | null {
  if (items.length === 0) {
    return null;
  }
  if (items.length === 1) {
    return items[0]?.id ?? null;
  }
  return items.find((row) => row.isDefault)?.id ?? items[0]?.id ?? null;
}
