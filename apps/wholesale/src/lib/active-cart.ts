/**
 * Which open cart "Add to Cart" targets. Stored per customer on this device;
 * the server does not know about it — every open draft is equal server-side.
 */
export const NEW_CART = "new" as const;

export type StoredActiveCart = string | typeof NEW_CART | null;

export type ActiveCartResolution<T> =
  | { kind: "draft"; draft: T }
  | { kind: "new" }
  | { kind: "none" };

export function activeCartStorageKey(customerId: string): string {
  return `wholesale.activeCart.${customerId}`;
}

/**
 * Stored id wins when it still exists; "new" means the next add opens a fresh draft;
 * otherwise fall back to the newest open cart; no carts at all means the next add
 * creates one.
 */
export function resolveActiveCart<T extends { id: string }>(
  drafts: readonly T[],
  stored: StoredActiveCart,
): ActiveCartResolution<T> {
  if (stored === NEW_CART) {
    return { kind: "new" };
  }
  if (stored !== null) {
    const match = drafts.find((draft) => draft.id === stored);
    if (match !== undefined) {
      return { kind: "draft", draft: match };
    }
  }
  const newest = drafts[0];
  if (newest !== undefined) {
    return { kind: "draft", draft: newest };
  }
  return { kind: "none" };
}

export type CartSummaryInput = {
  label?: string;
  documentNumber: string;
  lines: readonly { qty: number; unitPriceCents: number; currency: string }[];
};

export function cartDisplayName(cart: Pick<CartSummaryInput, "label" | "documentNumber">): string {
  const label = cart.label?.trim();
  if (label !== undefined && label.length > 0) {
    return label;
  }
  return `Cart ${cart.documentNumber}`;
}

export function cartLineCount(cart: Pick<CartSummaryInput, "lines">): number {
  return cart.lines.length;
}

export function cartUnitCount(cart: Pick<CartSummaryInput, "lines">): number {
  return cart.lines.reduce((sum, line) => sum + line.qty, 0);
}

export function cartSubtotalCents(cart: Pick<CartSummaryInput, "lines">): number {
  return cart.lines.reduce((sum, line) => sum + line.qty * line.unitPriceCents, 0);
}

export function cartCurrency(cart: Pick<CartSummaryInput, "lines">): string {
  return cart.lines[0]?.currency ?? "USD";
}
