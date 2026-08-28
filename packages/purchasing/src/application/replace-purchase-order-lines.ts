import {
  OrganizationId,
  PurchaseOrderId,
  Sku,
  type StaffUserId,
} from "@dc-inventory/shared-kernel";
import type { IPurchaseOrderRepository } from "../domain/ports/purchase-order-repository.js";
import type { PurchaseOrder, PurchaseOrderLine } from "../domain/purchase-order.js";
import { newUuid, PurchaseOrderLineId } from "../domain/ids.js";

export type ReplacePurchaseOrderLineInput = {
  sku: string;
  name: string;
  qty: number;
};

export type ReplacePurchaseOrderLinesRequest = {
  organizationId: OrganizationId;
  staffUserId: StaffUserId;
  purchaseOrderId: PurchaseOrderId;
  lines: readonly ReplacePurchaseOrderLineInput[];
};

export type ReplacePurchaseOrderLinesResult =
  | { ok: true; purchaseOrder: PurchaseOrder }
  | {
      ok: false;
      reason: "not_found" | "illegal_transition" | "empty_order" | "invalid";
    };

export class ReplacePurchaseOrderLinesUseCase {
  constructor(private readonly purchaseOrders: IPurchaseOrderRepository) {}

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
      const name = line.name.trim();
      if (name.length === 0 || !Number.isInteger(line.qty) || line.qty <= 0) {
        return { ok: false, reason: "invalid" };
      }
      try {
        const sku = Sku.parse(line.sku);
        if (seenSkus.has(sku.value)) {
          return { ok: false, reason: "invalid" };
        }
        seenSkus.add(sku.value);
        lines.push({
          id: PurchaseOrderLineId.parse(newUuid()),
          sku,
          name,
          qty: line.qty,
          receivedQty: 0,
        });
      } catch {
        return { ok: false, reason: "invalid" };
      }
    }

    const updated: PurchaseOrder = { ...existing, lines };
    await this.purchaseOrders.save(updated);
    return { ok: true, purchaseOrder: updated };
  }
}
