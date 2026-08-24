import { PurchaseOrderId, type StaffUserId } from "@dc-inventory/shared-kernel";
import { unreceivedQty, type PurchaseOrder } from "../domain/purchase-order.js";
import type { IPurchasingUnitOfWork } from "../domain/ports/purchase-order-repository.js";
import { PurchasingTransactionError } from "../domain/errors.js";

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
    try {
      return await this.uow.run(async (scope) => {
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
            idempotencyKey: `${input.idempotencyKey}:cancel:${line.id}`,
            sku: line.sku,
            quantity: remainder,
            purchaseOrderId: existing.id,
          });
          if (!result.ok) {
            if (result.reason === "idempotency_conflict") {
              throw new PurchasingTransactionError("idempotency_conflict");
            }
            throw new PurchasingTransactionError("inventory_conflict");
          }
        }

        const cancelled: PurchaseOrder = { ...existing, status: "cancelled" };
        await scope.purchaseOrders.save(cancelled);
        return { ok: true, purchaseOrder: cancelled };
      });
    } catch (error) {
      if (error instanceof PurchasingTransactionError) {
        return {
          ok: false,
          reason: error.reason as CancelPurchaseOrderResult extends { ok: false; reason: infer R }
            ? R
            : never,
        };
      }
      throw error;
    }
  }
}
