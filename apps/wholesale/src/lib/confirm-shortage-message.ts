export type ConfirmShortageFields = {
  name?: string;
  sku?: string;
  requestedQty?: number;
  availableQty?: number;
};

export function formatConfirmShortageMessage(
  shortage: ConfirmShortageFields,
): string | null {
  if (shortage.availableQty === undefined || shortage.requestedQty === undefined) {
    return null;
  }
  const product = shortage.name?.trim() || shortage.sku?.trim();
  if (product === undefined || product.length === 0) {
    return null;
  }
  if (shortage.availableQty <= 0) {
    return `${product} is sold out. You asked for ${shortage.requestedQty}.`;
  }
  return `${product} has ${shortage.availableQty} available. You asked for ${shortage.requestedQty}.`;
}

export const GENERIC_CONFIRM_ORDER_ERROR =
  "Could not confirm this order. Check availability and try again.";

export function wholesaleShortageErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error) || !("data" in error)) {
    return fallback;
  }
  const data = error.data;
  if (
    typeof data === "object" &&
    data !== null &&
    "error" in data &&
    data.error === "insufficient_atp"
  ) {
    const body = data as Record<string, unknown>;
    const shortage: ConfirmShortageFields = {
      ...(typeof body.name === "string" ? { name: body.name } : {}),
      ...(typeof body.sku === "string" ? { sku: body.sku } : {}),
      ...(typeof body.requestedQty === "number" ? { requestedQty: body.requestedQty } : {}),
      ...(typeof body.availableQty === "number" ? { availableQty: body.availableQty } : {}),
    };
    const specific = formatConfirmShortageMessage(shortage);
    if (specific !== null) {
      return specific;
    }
  }
  return fallback;
}

export function wholesaleConfirmErrorMessage(error: unknown): string {
  return wholesaleShortageErrorMessage(error, GENERIC_CONFIRM_ORDER_ERROR);
}
