import {
  OrderId,
  OrganizationId,
  type StaffUserId,
} from "@dc-inventory/shared-kernel";
import { computeLineDeallocateQuantity } from "../adapters/order-cover.js";
import { SalesTransactionError } from "../domain/errors.js";
import type { SalesOrderLineId } from "../domain/ids.js";
import type { ISalesUnitOfWork } from "../domain/ports/sales-order-repository.js";
import type { SalesOrder } from "../domain/sales-order.js";

export type DecommitSalesOrderLineRequest = {
  organizationId: OrganizationId;
  staffUserId: StaffUserId;
  salesOrderId: OrderId;
  lineId: SalesOrderLineId;
  idempotencyKey: string;
};

export type DecommitSalesOrderLineResult =
  | { ok: true; salesOrder: SalesOrder }
  | {
      ok: false;
      reason:
        | "not_found"
        | "line_not_found"
        | "illegal_transition"
        | "inventory_conflict"
        | "idempotency_conflict";
    };

export class DecommitSalesOrderLineUseCase {
  constructor(private readonly uow: ISalesUnitOfWork) {}

  async execute(input: DecommitSalesOrderLineRequest): Promise<DecommitSalesOrderLineResult> {
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
        if (existing.status !== "confirmed") {
          return { ok: false, reason: "illegal_transition" };
        }

        const line = existing.lines.find((candidate) => candidate.id === input.lineId);
        if (line === undefined) {
          return { ok: false, reason: "line_not_found" };
        }

        const decommitIdempotencyKey = `${input.idempotencyKey}:decommit:${line.id}`;
        if (line.decommitted) {
          const matches = await scope.inventory.matchesDecommittedIdempotency({
            organizationId: existing.organizationId,
            idempotencyKey: decommitIdempotencyKey,
            sku: line.sku,
            quantity: line.qty,
            orderId: existing.id,
          });
          if (matches) {
            return { ok: true, salesOrder: existing };
          }
          return { ok: false, reason: "illegal_transition" };
        }

        await scope.inventory.lockSnapshots([
          {
            organizationId: existing.organizationId,
            sku: line.sku,
          },
        ]);

        const decommitResult = await scope.inventory.recordDecommitted({
          organizationId: existing.organizationId,
          idempotencyKey: decommitIdempotencyKey,
          sku: line.sku,
          quantity: line.qty,
          orderId: existing.id,
        });
        if (!decommitResult.ok) {
          if (decommitResult.reason === "idempotency_conflict") {
            throw new SalesTransactionError("idempotency_conflict");
          }
          throw new SalesTransactionError("inventory_conflict");
        }

        const coverQty = await scope.inventory.getOrderCoverQuantity({
          organizationId: existing.organizationId,
          sku: line.sku,
          orderId: existing.id,
        });
        const deallocateQty = computeLineDeallocateQuantity(line.qty, coverQty);
        if (deallocateQty > 0) {
          const deallocateResult = await scope.inventory.recordDeallocated({
            organizationId: existing.organizationId,
            idempotencyKey: `${input.idempotencyKey}:deallocate:${line.id}`,
            sku: line.sku,
            quantity: deallocateQty,
            orderId: existing.id,
          });
          if (!deallocateResult.ok) {
            if (deallocateResult.reason === "idempotency_conflict") {
              throw new SalesTransactionError("idempotency_conflict");
            }
            throw new SalesTransactionError("inventory_conflict");
          }
        }

        const updatedLines = existing.lines.map((candidate) =>
          candidate.id === line.id ? { ...candidate, decommitted: true as const } : candidate,
        );
        const updated: SalesOrder = { ...existing, lines: updatedLines };
        await scope.salesOrders.save(updated);
        return { ok: true, salesOrder: updated };
      });
    } catch (error) {
      if (error instanceof SalesTransactionError) {
        return {
          ok: false,
          reason: error.reason as DecommitSalesOrderLineResult extends {
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
