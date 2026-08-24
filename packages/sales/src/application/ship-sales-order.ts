import { OrderId, type StaffUserId } from "@dc-inventory/shared-kernel";
import { SalesTransactionError } from "../domain/errors.js";
import type { ISalesUnitOfWork } from "../domain/ports/sales-order-repository.js";
import type { SalesOrder } from "../domain/sales-order.js";

export type ShipSalesOrderRequest = {
  staffUserId: StaffUserId;
  salesOrderId: OrderId;
  idempotencyKey: string;
};

export type ShipSalesOrderResult =
  | { ok: true; salesOrder: SalesOrder }
  | {
      ok: false;
      reason:
        | "not_found"
        | "illegal_transition"
        | "inventory_conflict"
        | "idempotency_conflict"
        | "accounting_invalid";
    };

function computeSubtotalCents(order: SalesOrder): number {
  return order.lines.reduce(
    (sum, line) => sum + line.qty * line.unitPrice.amountMinor,
    0,
  );
}

export class ShipSalesOrderUseCase {
  constructor(private readonly uow: ISalesUnitOfWork) {}

  async execute(input: ShipSalesOrderRequest): Promise<ShipSalesOrderResult> {
    void input.staffUserId;
    try {
      return await this.uow.run(async (scope) => {
        const existing = await scope.salesOrders.findById(input.salesOrderId);
        if (existing === null) {
          return { ok: false, reason: "not_found" };
        }
        if (existing.status === "shipped") {
          return { ok: true, salesOrder: existing };
        }
        if (existing.status !== "confirmed") {
          return { ok: false, reason: "illegal_transition" };
        }
        if (existing.lines.length === 0) {
          return { ok: false, reason: "illegal_transition" };
        }

        for (const line of existing.lines) {
          const result = await scope.inventory.recordShipped({
            idempotencyKey: `${input.idempotencyKey}:ship:${line.id}`,
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

        const subtotalCents = computeSubtotalCents(existing);
        const currency = existing.lines[0]?.unitPrice.currency ?? "USD";
        const invoiceResult = await scope.accounting.createInvoiceForOrder({
          orderId: existing.id,
          customerId: existing.customerId,
          subtotalCents,
          currency,
        });
        if (!invoiceResult.ok) {
          throw new SalesTransactionError("accounting_invalid");
        }

        const shipped: SalesOrder = { ...existing, status: "shipped" };
        await scope.salesOrders.save(shipped);
        return { ok: true, salesOrder: shipped };
      });
    } catch (error) {
      if (error instanceof SalesTransactionError) {
        return {
          ok: false,
          reason: error.reason as ShipSalesOrderResult extends { ok: false; reason: infer R }
            ? R
            : never,
        };
      }
      throw error;
    }
  }
}
