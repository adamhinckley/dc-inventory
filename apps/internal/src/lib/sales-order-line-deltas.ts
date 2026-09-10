import type { SalesOrderLineDraft } from "./sales-order-types";

export type InternalSalesOrderLineDeltaBody = {
  add?: Array<{ productId: string; qty: number }>;
  update?: Array<{ sku: string; qty: number }>;
  remove?: string[];
};

export function salesOrderLineDeltaBody(
  saved: readonly SalesOrderLineDraft[],
  next: readonly SalesOrderLineDraft[],
): InternalSalesOrderLineDeltaBody {
  const savedBySku = new Map(saved.map((line) => [line.sku, line]));
  const nextBySku = new Map(next.map((line) => [line.sku, line]));
  const add: InternalSalesOrderLineDeltaBody["add"] = [];
  const update: InternalSalesOrderLineDeltaBody["update"] = [];
  const remove: InternalSalesOrderLineDeltaBody["remove"] = [];

  for (const line of next) {
    const previous = savedBySku.get(line.sku);
    if (previous === undefined) {
      add.push({ productId: line.productId, qty: line.qty });
      continue;
    }
    if (previous.qty !== line.qty) {
      update.push({ sku: line.sku, qty: line.qty });
    }
  }

  for (const line of saved) {
    if (!nextBySku.has(line.sku)) {
      remove.push(line.sku);
    }
  }

  return {
    ...(add.length > 0 ? { add } : {}),
    ...(update.length > 0 ? { update } : {}),
    ...(remove.length > 0 ? { remove } : {}),
  };
}

export function hasSalesOrderLineDeltaWork(body: InternalSalesOrderLineDeltaBody): boolean {
  return (
    (body.add?.length ?? 0) > 0 ||
    (body.update?.length ?? 0) > 0 ||
    (body.remove?.length ?? 0) > 0
  );
}
