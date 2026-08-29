import {
  OrganizationId,
  PurchaseOrderId,
  Sku,
  type StaffUserId,
} from "@dc-inventory/shared-kernel";
import type { IPurchaseOrderRepository } from "../domain/ports/purchase-order-repository.js";
import type { ICatalogSkuLookupPort } from "../domain/ports/supplier-product-repository.js";
import { parseIsoDate } from "../domain/iso-date.js";
import type { PurchaseOrder, PurchaseOrderLine } from "../domain/purchase-order.js";
import { newUuid, PurchaseOrderLineId } from "../domain/ids.js";

export type ReplacePurchaseOrderLineInput = {
  sku: string;
  /**
   * Accepted for wire compatibility only. Catalog supplies the frozen line name.
   */
  name?: string;
  qty: number;
};

export type ReplacePurchaseOrderLinesRequest = {
  organizationId: OrganizationId;
  staffUserId: StaffUserId;
  purchaseOrderId: PurchaseOrderId;
  lines: readonly ReplacePurchaseOrderLineInput[];
  shipDate?: string | null;
  cancelDate?: string | null;
};

export type ReplacePurchaseOrderLinesResult =
  | { ok: true; purchaseOrder: PurchaseOrder }
  | {
      ok: false;
      reason:
        | "not_found"
        | "illegal_transition"
        | "empty_order"
        | "invalid"
        | "product_not_found"
        | "product_archived";
    };

export class ReplacePurchaseOrderLinesUseCase {
  constructor(
    private readonly purchaseOrders: IPurchaseOrderRepository,
    private readonly catalog: ICatalogSkuLookupPort,
  ) {}

  async execute(input: ReplacePurchaseOrderLinesRequest): Promise<ReplacePurchaseOrderLinesResult> {
    void input.staffUserId;
    if (input.lines.length === 0) {
      return { ok: false, reason: "empty_order" };
    }

    const existing = await this.purchaseOrders.findById(
      input.organizationId,
      input.purchaseOrderId,
    );
    if (existing === null) {
      return { ok: false, reason: "not_found" };
    }
    if (existing.status !== "draft") {
      return { ok: false, reason: "illegal_transition" };
    }

    const lines: PurchaseOrderLine[] = [];
    const seenSkus = new Set<string>();
    for (const line of input.lines) {
      if (!Number.isInteger(line.qty) || line.qty <= 0) {
        return { ok: false, reason: "invalid" };
      }
      try {
        const requestedSku = Sku.parse(line.sku);
        const product = await this.catalog.findBySku(input.organizationId, requestedSku);
        if (product === null) {
          return { ok: false, reason: "product_not_found" };
        }
        if (product.archived) {
          return { ok: false, reason: "product_archived" };
        }
        const name = product.name.trim();
        if (name.length === 0 || seenSkus.has(product.sku.value)) {
          return { ok: false, reason: "invalid" };
        }
        seenSkus.add(product.sku.value);
        lines.push({
          id: PurchaseOrderLineId.parse(newUuid()),
          sku: product.sku,
          name,
          qty: line.qty,
          receivedQty: 0,
        });
      } catch {
        return { ok: false, reason: "invalid" };
      }
    }

    const shipDate =
      input.shipDate === undefined ? existing.shipDate : parseIsoDate(input.shipDate);
    const cancelDate =
      input.cancelDate === undefined ? existing.cancelDate : parseIsoDate(input.cancelDate);
    if (shipDate === "invalid" || cancelDate === "invalid") {
      return { ok: false, reason: "invalid" };
    }

    const updated: PurchaseOrder = {
      ...existing,
      shipDate,
      cancelDate,
      lines,
    };
    await this.purchaseOrders.save(updated);
    return { ok: true, purchaseOrder: updated };
  }
}
