import { OrderId, OrganizationId, type StaffUserId } from "@dc-inventory/shared-kernel";
import { SalesTransactionError, type SalesShortage } from "../domain/errors.js";
import type { ICustomerBillToSnapshotReadPort } from "../domain/ports/customer-bill-to-snapshot-read.js";
import type { ISalesUnitOfWork } from "../domain/ports/sales-order-repository.js";
import { liveSalesOrderLines, type SalesOrder } from "../domain/sales-order.js";

export type ShipSalesOrderRequest = {
  organizationId: OrganizationId;
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
        | "accounting_invalid"
        | "bill_to_missing";
    }
  | { ok: false; reason: "insufficient_cover"; shortage?: SalesShortage };

function computeSubtotalCents(lines: readonly SalesOrder["lines"][number][]): number {
  return lines.reduce((sum, line) => sum + line.qty * line.unitPrice.amountMinor, 0);
}

export class ShipSalesOrderUseCase {
  constructor(
    private readonly uow: ISalesUnitOfWork,
    private readonly billToSnapshot: ICustomerBillToSnapshotReadPort,
  ) {}

  async execute(input: ShipSalesOrderRequest): Promise<ShipSalesOrderResult> {
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
        if (existing.status === "shipped") {
          return { ok: true, salesOrder: existing };
        }
        if (existing.status !== "confirmed") {
          return { ok: false, reason: "illegal_transition" };
        }
        const liveLines = liveSalesOrderLines(existing.lines);
        if (liveLines.length === 0) {
          return { ok: false, reason: "illegal_transition" };
        }

        const billTo = await this.billToSnapshot.getBillToAddressSnapshot(
          existing.organizationId,
          existing.customerId,
        );
        if (billTo === null) {
          return { ok: false, reason: "bill_to_missing" };
        }

        await scope.inventory.lockSnapshots(
          liveLines.map((line) => ({
            organizationId: existing.organizationId,
            sku: line.sku,
          })),
        );
        for (const line of liveLines) {
          const result = await scope.inventory.recordShipped({
            organizationId: existing.organizationId,
            idempotencyKey: `${input.idempotencyKey}:ship:${line.id}`,
            sku: line.sku,
            quantity: line.qty,
            orderId: existing.id,
          });
          if (!result.ok) {
            if (result.reason === "idempotency_conflict") {
              throw new SalesTransactionError("idempotency_conflict");
            }
            if (
              result.reason === "insufficient_allocated" ||
              result.reason === "insufficient_committed" ||
              result.reason === "insufficient_on_hand"
            ) {
              const covered = await scope.inventory.getOrderCoverQuantity({
                organizationId: existing.organizationId,
                sku: line.sku,
                orderId: existing.id,
              });
              throw new SalesTransactionError("insufficient_cover", {
                sku: line.sku.value,
                name: line.name,
                requestedQty: line.qty,
                availableQty: covered,
              });
            }
            throw new SalesTransactionError("inventory_conflict");
          }
        }

        const subtotalCents = computeSubtotalCents(liveLines);
        const currency = liveLines[0]?.unitPrice.currency ?? "USD";
        const invoiceResult = await scope.accounting.createInvoiceForOrder({
          organizationId: existing.organizationId,
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
        if (error.reason === "insufficient_cover") {
          return { ok: false, reason: "insufficient_cover", shortage: error.shortage };
        }
        return {
          ok: false,
          reason: error.reason as Exclude<
            ShipSalesOrderResult extends { ok: false; reason: infer R } ? R : never,
            "insufficient_cover"
          >,
        };
      }
      throw error;
    }
  }
}
