import { Sku, type OrganizationId } from "@dc-inventory/shared-kernel";
import { newUuid, PurchaseOrderLineId } from "../domain/ids.js";
import type { ICatalogSkuLookupPort } from "../domain/ports/supplier-product-repository.js";
import type { PurchaseOrderLine } from "../domain/purchase-order.js";

export type DraftPurchaseOrderLineInput = {
  sku: string;
  qty: number;
};

export type ResolveDraftPurchaseOrderLinesResult =
  | { ok: true; lines: PurchaseOrderLine[] }
  | { ok: false; reason: "invalid" | "product_not_found" | "product_archived" };

export async function resolveDraftPurchaseOrderLines(
  catalog: ICatalogSkuLookupPort,
  organizationId: OrganizationId,
  inputs: readonly DraftPurchaseOrderLineInput[],
): Promise<ResolveDraftPurchaseOrderLinesResult> {
  const parsed: { sku: Sku; qty: number }[] = [];
  const seenSkus = new Set<string>();
  for (const line of inputs) {
    if (!Number.isInteger(line.qty) || line.qty <= 0) {
      return { ok: false, reason: "invalid" };
    }
    try {
      const sku = Sku.parse(line.sku);
      if (seenSkus.has(sku.value)) {
        return { ok: false, reason: "invalid" };
      }
      seenSkus.add(sku.value);
      parsed.push({ sku, qty: line.qty });
    } catch {
      return { ok: false, reason: "invalid" };
    }
  }

  const products = await catalog.findBySkus(
    organizationId,
    parsed.map((line) => line.sku),
  );

  const lines: PurchaseOrderLine[] = [];
  for (const line of parsed) {
    const product = products.get(line.sku.value);
    if (product === undefined) {
      return { ok: false, reason: "product_not_found" };
    }
    if (product.archived) {
      return { ok: false, reason: "product_archived" };
    }
    const name = product.name.trim();
    if (name.length === 0) {
      return { ok: false, reason: "invalid" };
    }
    lines.push({
      id: PurchaseOrderLineId.parse(newUuid()),
      sku: product.sku,
      name,
      qty: line.qty,
      receivedQty: 0,
    });
  }
  return { ok: true, lines };
}
