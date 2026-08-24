import { PurchaseOrderId, type StaffUserId } from "@dc-inventory/shared-kernel";
import type { IPurchasingUnitOfWork } from "../domain/ports/purchase-order-repository.js";
import type { PurchaseOrder } from "../domain/purchase-order.js";
import { PurchasingTransactionError } from "../domain/errors.js";

export type ConfirmPurchaseOrderRequest = {
  staffUserId: StaffUserId;
  purchaseOrderId: PurchaseOrderId;
  idempotencyKey: string;
};

export type ConfirmPurchaseOrderResult =
  | { ok: true; purchaseOrder: PurchaseOrder }
  | {
      ok: false;
      reason:
        | "not_found"
        | "illegal_transition"
        | "empty_order"
        | "inventory_conflict"
        | "idempotency_conflict";
    };

export class ConfirmPurchaseOrderUseCase {
  constructor(private readonly uow: IPurchasingUnitOfWork) {}

  async execute(input: ConfirmPurchaseOrderRequest): Promise<ConfirmPurchaseOrderResult> {
    void input.staffUserId;
    try {
      return await this.uow.run(async (scope) => {
        const existing = await scope.purchaseOrders.findById(input.purchaseOrderId);
        if (existing === null) {
          return { ok: false, reason: "not_found" };
        }
        if (existing.status !== "draft") {
          return { ok: false, reason: "illegal_transition" };
        }
        if (existing.lines.length === 0) {
          return { ok: false, reason: "empty_order" };
        }

        for (const line of existing.lines) {
          const result = await scope.inventory.recordInboundFromPo({
            idempotencyKey: `${input.idempotencyKey}:confirm:${line.id}`,
            sku: line.sku,
            quantity: line.qty,
            purchaseOrderId: existing.id,
          });
          if (!result.ok) {
            if (result.reason === "idempotency_conflict") {
              throw new PurchasingTransactionError("idempotency_conflict");
            }
            throw new PurchasingTransactionError("inventory_conflict");
          }
        }

        const updated: PurchaseOrder = { ...existing, status: "confirmed" };
        await scope.purchaseOrders.save(updated);
        return { ok: true, purchaseOrder: updated };
      });
    } catch (error) {
      if (error instanceof PurchasingTransactionError) {
        return { ok: false, reason: error.reason as ConfirmPurchaseOrderResult extends { ok: false; reason: infer R } ? R : never };
      }
      throw error;
    }
  }
}
