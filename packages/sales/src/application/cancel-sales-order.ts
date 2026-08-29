import { OrderId, OrganizationId, type StaffUserId } from "@dc-inventory/shared-kernel";
import { SalesTransactionError } from "../domain/errors.js";
import type { ISalesUnitOfWork } from "../domain/ports/sales-order-repository.js";
import type { SalesOrder } from "../domain/sales-order.js";

export type CancelSalesOrderRequest = {
  organizationId: OrganizationId;
  staffUserId: StaffUserId;
  salesOrderId: OrderId;
  idempotencyKey: string;
};

export type CancelSalesOrderResult =
  | { ok: true; salesOrder: SalesOrder }
  | {
      ok: false;
      reason:
        | "not_found"
        | "illegal_transition"
        | "inventory_conflict"
        | "idempotency_conflict";
    };

export class CancelSalesOrderUseCase {
  constructor(private readonly uow: ISalesUnitOfWork) {}

  async execute(input: CancelSalesOrderRequest): Promise<CancelSalesOrderResult> {
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
        if (existing.status === "shipped" || existing.status === "cancelled") {
          return { ok: false, reason: "illegal_transition" };
        }

        if (existing.status === "draft") {
          const cancelled: SalesOrder = { ...existing, status: "cancelled" };
          await scope.salesOrders.save(cancelled);
          return { ok: true, salesOrder: cancelled };
        }

        await scope.inventory.lockSnapshots(
          existing.lines.map((line) => ({
            organizationId: existing.organizationId,
            sku: line.sku,
          })),
        );
        for (const line of existing.lines) {
          const result = await scope.inventory.recordDeallocated({
            organizationId: existing.organizationId,
            idempotencyKey: `${input.idempotencyKey}:cancel:${line.id}`,
            sku: line.sku,
            quantity: line.qty,
            orderId: existing.id,
          });
          if (!result.ok) {
            if (result.reason === "idempotency_conflict") {
              throw new SalesTransactionError("idempotency_conflict");
            }
            throw new SalesTransactionError("inventory_conflict");
          }
        }

        const cancelled: SalesOrder = { ...existing, status: "cancelled" };
        await scope.salesOrders.save(cancelled);
        return { ok: true, salesOrder: cancelled };
      });
    } catch (error) {
      if (error instanceof SalesTransactionError) {
        return {
          ok: false,
          reason: error.reason as CancelSalesOrderResult extends { ok: false; reason: infer R }
            ? R
            : never,
        };
      }
      throw error;
    }
  }
}
