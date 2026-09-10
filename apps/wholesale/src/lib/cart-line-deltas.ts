import type { WholesaleDraftCartListResult, WholesaleDraftCartOrder } from "./wholesale-cart-cache";

export type CartLineDeltaBody = {
  add?: Array<{ productId: string; qty: number }>;
  update?: Array<{ lineId?: string; sku?: string; qty: number }>;
  remove?: string[];
};

type TargetLine = { productId: string; qty: number };

/** Last server-truth lines before an optimistic qty burst; avoids empty deltas after cache writes. */
export function cartDeltaBaselineLines(
  draftId: string,
  currentLines: WholesaleDraftCartOrder["lines"],
  burstPrevious: WholesaleDraftCartListResult | undefined,
): WholesaleDraftCartOrder["lines"] {
  return (
    burstPrevious?.data.items.find((item) => item.id === draftId)?.lines ?? currentLines
  );
}

/** Build a minimal line-jobs body from baseline draft lines and a target replace snapshot. */
export function cartLinesToDeltaBody(
  currentLines: WholesaleDraftCartOrder["lines"],
  targetLines: readonly TargetLine[],
): CartLineDeltaBody {
  const currentByProductId = new Map<
    string,
    { id: string; sku: string; qty: number }
  >();
  for (const line of currentLines) {
    if (line.productId === undefined) {
      continue;
    }
    currentByProductId.set(line.productId, {
      id: line.id,
      sku: line.sku,
      qty: line.qty,
    });
  }

  const targetByProductId = new Map(targetLines.map((line) => [line.productId, line.qty]));
  const add: CartLineDeltaBody["add"] = [];
  const update: CartLineDeltaBody["update"] = [];
  const remove: CartLineDeltaBody["remove"] = [];

  for (const [productId, qty] of targetByProductId) {
    const existing = currentByProductId.get(productId);
    if (existing === undefined) {
      add.push({ productId, qty });
      continue;
    }
    if (existing.qty !== qty) {
      update.push({ lineId: existing.id, qty });
    }
  }

  for (const [productId, existing] of currentByProductId) {
    if (!targetByProductId.has(productId)) {
      remove.push(existing.id);
    }
  }

  return {
    ...(add.length > 0 ? { add } : {}),
    ...(update.length > 0 ? { update } : {}),
    ...(remove.length > 0 ? { remove } : {}),
  };
}

export function hasCartLineDeltaWork(body: CartLineDeltaBody): boolean {
  return (
    (body.add?.length ?? 0) > 0 ||
    (body.update?.length ?? 0) > 0 ||
    (body.remove?.length ?? 0) > 0
  );
}

export function singleProductCartDelta(
  currentLines: WholesaleDraftCartOrder["lines"],
  productId: string,
  qty: number,
): CartLineDeltaBody {
  const existing = currentLines.find((line) => line.productId === productId);
  if (existing === undefined) {
    return { add: [{ productId, qty }] };
  }
  if (qty <= 0) {
    return { remove: [existing.id] };
  }
  if (existing.qty === qty) {
    return {};
  }
  return { update: [{ lineId: existing.id, qty }] };
}
