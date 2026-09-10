import { OrganizationId, PurchaseOrderId, type StaffUserId } from "@dc-inventory/shared-kernel";
import type { IPurchasingUnitOfWork } from "../domain/ports/purchase-order-repository.js";
import type { PurchaseOrder } from "../domain/purchase-order.js";
import { PurchasingTransactionError } from "../domain/errors.js";

export type UnconfirmPurchaseOrderRequest = {
  organizationId: OrganizationId;
  staffUserId: StaffUserId;
  purchaseOrderId: PurchaseOrderId;
  idempotencyKey: string;
};

export type UnconfirmPurchaseOrderResult =
  | { ok: true; purchaseOrder: PurchaseOrder }
  | {
      ok: false;
      reason:
        | "not_found"
        | "illegal_transition"
        | "inventory_conflict"
        | "idempotency_conflict";
    };

export class UnconfirmPurchaseOrderUseCase {
  constructor(private readonly uow: IPurchasingUnitOfWork) {}

  async execute(input: UnconfirmPurchaseOrderRequest): Promise<UnconfirmPurchaseOrderResult> {
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
        if (existing.status !== "confirmed") {
          return { ok: false, reason: "illegal_transition" };
        }
        if (existing.lines.some((line) => line.receivedQty > 0)) {
          return { ok: false, reason: "illegal_transition" };
        }

        await scope.inventory.lockSnapshots(
          existing.lines.map((line) => ({
            organizationId: existing.organizationId,
            sku: line.sku,
          })),
        );
        const cancelResult = await scope.inventory.recordInboundCancelledBulk(
          existing.lines.map((line) => ({
            organizationId: existing.organizationId,
            idempotencyKey: `${input.idempotencyKey}:unconfirm:${line.id}`,
            sku: line.sku,
            quantity: line.qty,
            purchaseOrderId: existing.id,
          })),
        );
        if (!cancelResult.ok) {
          if (cancelResult.reason === "idempotency_conflict") {
            throw new PurchasingTransactionError("idempotency_conflict");
          }
          throw new PurchasingTransactionError("inventory_conflict");
        }

        const updated: PurchaseOrder = { ...existing, status: "draft" };
        await scope.purchaseOrders.save(updated);
        return { ok: true, purchaseOrder: updated };
      });
    } catch (error) {
      if (error instanceof PurchasingTransactionError) {
        return {
          ok: false,
          reason: error.reason as UnconfirmPurchaseOrderResult extends { ok: false; reason: infer R }
            ? R
            : never,
        };
      }
      throw error;
    }
  }
}
