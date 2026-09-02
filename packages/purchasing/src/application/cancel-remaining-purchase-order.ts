import { OrganizationId, PurchaseOrderId, type StaffUserId } from "@dc-inventory/shared-kernel";
import { unreceivedQty, type PurchaseOrder } from "../domain/purchase-order.js";
import type { IPurchasingUnitOfWork } from "../domain/ports/purchase-order-repository.js";
import { PurchasingTransactionError } from "../domain/errors.js";

export type CancelRemainingPurchaseOrderRequest = {
  organizationId: OrganizationId;
  staffUserId: StaffUserId;
  purchaseOrderId: PurchaseOrderId;
  idempotencyKey: string;
};

export type CancelRemainingPurchaseOrderResult =
  | { ok: true; purchaseOrder: PurchaseOrder }
  | {
      ok: false;
      reason:
        | "not_found"
        | "illegal_transition"
        | "inventory_conflict"
        | "idempotency_conflict";
    };

function isLegalCancelRemaining(po: PurchaseOrder): boolean {
  const hasReceived = po.lines.some((line) => line.receivedQty > 0);
  const hasRemainder = po.lines.some((line) => unreceivedQty(line) > 0);
  if (!hasReceived || !hasRemainder) {
    return false;
  }
  return po.status === "confirmed" || po.status === "received";
}

export class CancelRemainingPurchaseOrderUseCase {
  constructor(private readonly uow: IPurchasingUnitOfWork) {}

  async execute(
    input: CancelRemainingPurchaseOrderRequest,
  ): Promise<CancelRemainingPurchaseOrderResult> {
    void input.staffUserId;
    try {
      return await this.uow.run(async (scope) => {
        const existing = await scope.purchaseOrders.findById(
          input.organizationId,
          input.purchaseOrderId,
        );
        if (existing === null) {
          return { ok: false, reason: "not_found" };
        }
        if (!isLegalCancelRemaining(existing)) {
          return { ok: false, reason: "illegal_transition" };
        }

        const linesToCancel = existing.lines
          .map((line) => ({ line, remainder: unreceivedQty(line) }))
          .filter(({ remainder }) => remainder > 0);
        await scope.inventory.lockSnapshots(
          linesToCancel.map(({ line }) => ({
            organizationId: existing.organizationId,
            sku: line.sku,
          })),
        );
        for (const { line, remainder } of linesToCancel) {
          const result = await scope.inventory.recordInboundCancelled({
            organizationId: existing.organizationId,
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

        const received: PurchaseOrder = { ...existing, status: "received" };
        await scope.purchaseOrders.save(received);
        return { ok: true, purchaseOrder: received };
      });
    } catch (error) {
      if (error instanceof PurchasingTransactionError) {
        return {
          ok: false,
          reason: error.reason as CancelRemainingPurchaseOrderResult extends {
            ok: false;
            reason: infer R;
          }
            ? R
            : never,
        };
      }
      throw error;
    }
  }
}
