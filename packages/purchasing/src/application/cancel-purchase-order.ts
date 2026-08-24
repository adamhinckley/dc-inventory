import { PurchaseOrderId, type StaffUserId } from "@dc-inventory/shared-kernel";
import { unreceivedQty, type PurchaseOrder } from "../domain/purchase-order.js";
import type { IPurchasingUnitOfWork } from "../domain/ports/purchase-order-repository.js";

export type CancelPurchaseOrderRequest = {
  staffUserId: StaffUserId;
  purchaseOrderId: PurchaseOrderId;
  idempotencyKey: string;
};

export type CancelPurchaseOrderResult =
  | { ok: true; purchaseOrder: PurchaseOrder }
  | {
      ok: false;
      reason:
        | "not_found"
        | "illegal_transition"
        | "inventory_conflict"
        | "idempotency_conflict";
    };

export class CancelPurchaseOrderUseCase {
  constructor(private readonly uow: IPurchasingUnitOfWork) {}

  async execute(input: CancelPurchaseOrderRequest): Promise<CancelPurchaseOrderResult> {
    void input.staffUserId;
    return this.uow.run(async (scope) => {
      const existing = await scope.purchaseOrders.findById(input.purchaseOrderId);
      if (existing === null) {
        return { ok: false, reason: "not_found" };
      }
      if (existing.status === "received" || existing.status === "cancelled") {
        return { ok: false, reason: "illegal_transition" };
      }

      if (existing.status === "draft") {
        const cancelled: PurchaseOrder = { ...existing, status: "cancelled" };
        await scope.purchaseOrders.save(cancelled);
        return { ok: true, purchaseOrder: cancelled };
      }

      for (const line of existing.lines) {
        const remainder = unreceivedQty(line);
        if (remainder <= 0) {
          continue;
        }
        const result = await scope.inventory.recordInboundCancelled({
          idempotencyKey: `${input.idempotencyKey}:cancel:${line.sku.value}`,
          sku: line.sku,
          quantity: remainder,
          purchaseOrderId: existing.id,
        });
        if (!result.ok) {
          if (result.reason === "idempotency_conflict") {
            return { ok: false, reason: "idempotency_conflict" };
          }
          return { ok: false, reason: "inventory_conflict" };
        }
      }

      const cancelled: PurchaseOrder = { ...existing, status: "cancelled" };
      await scope.purchaseOrders.save(cancelled);
      return { ok: true, purchaseOrder: cancelled };
    });
  }
}
