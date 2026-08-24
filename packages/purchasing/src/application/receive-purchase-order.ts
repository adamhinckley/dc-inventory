import { PurchaseOrderId, type StaffUserId } from "@dc-inventory/shared-kernel";
import { PurchaseOrderLineId } from "../domain/ids.js";
import {
  isFullyReceived,
  unreceivedQty,
  type PurchaseOrder,
  type PurchaseOrderLine,
} from "../domain/purchase-order.js";
import type { IPurchasingUnitOfWork } from "../domain/ports/purchase-order-repository.js";

export type ReceivePurchaseOrderLineInput = {
  lineId: PurchaseOrderLineId;
  quantity: number;
};

export type ReceivePurchaseOrderRequest = {
  staffUserId: StaffUserId;
  purchaseOrderId: PurchaseOrderId;
  lines: readonly ReceivePurchaseOrderLineInput[];
  idempotencyKey: string;
};

export type ReceivePurchaseOrderResult =
  | { ok: true; purchaseOrder: PurchaseOrder }
  | {
      ok: false;
      reason:
        | "not_found"
        | "illegal_transition"
        | "invalid"
        | "over_receive"
        | "line_not_found"
        | "inventory_conflict"
        | "idempotency_conflict";
    };

export class ReceivePurchaseOrderUseCase {
  constructor(private readonly uow: IPurchasingUnitOfWork) {}

  async execute(input: ReceivePurchaseOrderRequest): Promise<ReceivePurchaseOrderResult> {
    void input.staffUserId;
    if (input.lines.length === 0) {
      return { ok: false, reason: "invalid" };
    }

    return this.uow.run(async (scope) => {
      const existing = await scope.purchaseOrders.findById(input.purchaseOrderId);
      if (existing === null) {
        return { ok: false, reason: "not_found" };
      }
      if (existing.status !== "confirmed") {
        return { ok: false, reason: "illegal_transition" };
      }

      const lineById = new Map(existing.lines.map((line) => [line.id, line]));
      const updatedLines = [...existing.lines];

      for (const receive of input.lines) {
        if (!Number.isInteger(receive.quantity) || receive.quantity <= 0) {
          return { ok: false, reason: "invalid" };
        }
        const line = lineById.get(receive.lineId);
        if (line === undefined) {
          return { ok: false, reason: "line_not_found" };
        }
        const remainder = unreceivedQty(line);
        if (receive.quantity > remainder) {
          return { ok: false, reason: "over_receive" };
        }

        const result = await scope.inventory.recordGoodsReceived({
          idempotencyKey: `${input.idempotencyKey}:receive:${line.id}:${receive.quantity}`,
          sku: line.sku,
          quantity: receive.quantity,
          purchaseOrderId: existing.id,
        });
        if (!result.ok) {
          if (result.reason === "idempotency_conflict") {
            return { ok: false, reason: "idempotency_conflict" };
          }
          return { ok: false, reason: "inventory_conflict" };
        }

        const nextLine: PurchaseOrderLine = {
          ...line,
          receivedQty: line.receivedQty + receive.quantity,
        };
        lineById.set(line.id, nextLine);
        const index = updatedLines.findIndex((row) => row.id === line.id);
        if (index >= 0) {
          updatedLines[index] = nextLine;
        }
      }

      const purchaseOrder: PurchaseOrder = {
        ...existing,
        lines: updatedLines,
        status: isFullyReceived({ ...existing, lines: updatedLines }) ? "received" : "confirmed",
      };
      await scope.purchaseOrders.save(purchaseOrder);
      return { ok: true, purchaseOrder };
    });
  }
}
