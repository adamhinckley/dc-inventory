import { OrderId, OrganizationId, type StaffUserId } from "@dc-inventory/shared-kernel";
import { SalesTransactionError } from "../domain/errors.js";
import type { ISalesUnitOfWork } from "../domain/ports/sales-order-repository.js";
import type { SalesOrder } from "../domain/sales-order.js";

export type ConfirmSalesOrderRequest = {
  organizationId: OrganizationId;
  staffUserId: StaffUserId;
  salesOrderId: OrderId;
  idempotencyKey: string;
};

export type ConfirmSalesOrderResult =
  | { ok: true; salesOrder: SalesOrder }
  | {
      ok: false;
      reason:
        | "not_found"
        | "illegal_transition"
        | "empty_order"
        | "insufficient_atp"
        | "inventory_conflict"
        | "idempotency_conflict";
    };

export class ConfirmSalesOrderUseCase {
  constructor(private readonly uow: ISalesUnitOfWork) {}

  async execute(input: ConfirmSalesOrderRequest): Promise<ConfirmSalesOrderResult> {
    void input.staffUserId;
    try {
      return await this.uow.run(async (scope) => {
        const existing = await scope.salesOrders.findById(
          input.organizationId,
          input.salesOrderId,
        );
        if (existing === null) {
          return { ok: false, reason: "not_found" };
        }
        if (existing.status !== "draft") {
          return { ok: false, reason: "illegal_transition" };
        }
        if (existing.lines.length === 0) {
          return { ok: false, reason: "empty_order" };
        }

        await scope.inventory.lockSnapshots(
          existing.lines.map((line) => ({
            organizationId: existing.organizationId,
            sku: line.sku,
          })),
        );
        for (const line of existing.lines) {
          const result = await scope.inventory.recordAllocated({
            organizationId: existing.organizationId,
            idempotencyKey: `${input.idempotencyKey}:confirm:${line.id}`,
            sku: line.sku,
            quantity: line.qty,
            orderId: existing.id,
          });
          if (!result.ok) {
            if (result.reason === "idempotency_conflict") {
              throw new SalesTransactionError("idempotency_conflict");
            }
            if (result.reason === "insufficient_available") {
              throw new SalesTransactionError("insufficient_atp");
            }
            throw new SalesTransactionError("inventory_conflict");
          }
        }

        const updated: SalesOrder = { ...existing, status: "confirmed" };
        await scope.salesOrders.save(updated);
        return { ok: true, salesOrder: updated };
      });
    } catch (error) {
      if (error instanceof SalesTransactionError) {
        return {
          ok: false,
          reason: error.reason as ConfirmSalesOrderResult extends { ok: false; reason: infer R }
            ? R
            : never,
        };
      }
      throw error;
    }
  }
}
