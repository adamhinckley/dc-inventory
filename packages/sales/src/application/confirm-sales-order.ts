import { OrderId, OrganizationId, type StaffUserId } from "@dc-inventory/shared-kernel";
import { SalesTransactionError } from "../domain/errors.js";
import type {
  ICustomerLookupPort,
  ISalesUnitOfWork,
} from "../domain/ports/sales-order-repository.js";
import type { SalesOrder } from "../domain/sales-order.js";
import { confirmAccountStatusGate } from "./account-status-gate.js";

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
        | "idempotency_conflict"
        | "customer_on_hold"
        | "customer_inactive"
        | "customer_not_found";
    };

export class ConfirmSalesOrderUseCase {
  constructor(
    private readonly uow: ISalesUnitOfWork,
    private readonly customers: ICustomerLookupPort,
  ) {}

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
        if (existing.status === "confirmed") {
          for (const line of existing.lines) {
            const matches = await scope.inventory.matchesCommittedIdempotency({
              organizationId: existing.organizationId,
              idempotencyKey: `${input.idempotencyKey}:confirm:${line.id}`,
              sku: line.sku,
              quantity: line.qty,
              orderId: existing.id,
            });
            if (!matches) {
              return { ok: false, reason: "illegal_transition" };
            }
          }
          return { ok: true, salesOrder: existing };
        }
        if (existing.status !== "draft") {
          return { ok: false, reason: "illegal_transition" };
        }
        if (existing.lines.length === 0) {
          return { ok: false, reason: "empty_order" };
        }

        const customer = await this.customers.findById(
          input.organizationId,
          existing.customerId,
        );
        if (customer === null) {
          return { ok: false, reason: "customer_not_found" };
        }
        const accountStatusGate = confirmAccountStatusGate(customer.accountStatus);
        if (accountStatusGate !== null) {
          return { ok: false, reason: accountStatusGate };
        }

        await scope.inventory.lockSnapshots(
          existing.lines.map((line) => ({
            organizationId: existing.organizationId,
            sku: line.sku,
          })),
        );
        for (const line of existing.lines) {
          const result = await scope.inventory.recordCommitted({
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
            if (
              result.reason === "insufficient_available_to_sell" ||
              result.reason === "insufficient_available"
            ) {
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
