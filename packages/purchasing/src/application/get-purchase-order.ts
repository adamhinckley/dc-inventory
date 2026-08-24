import { PurchaseOrderId, type StaffUserId } from "@dc-inventory/shared-kernel";
import type { IPurchaseOrderRepository } from "../domain/ports/purchase-order-repository.js";
import type { PurchaseOrder } from "../domain/purchase-order.js";

export type GetPurchaseOrderRequest = {
  staffUserId: StaffUserId;
  purchaseOrderId: PurchaseOrderId;
};

export type GetPurchaseOrderResult =
  | { ok: true; purchaseOrder: PurchaseOrder }
  | { ok: false; reason: "not_found" };

export class GetPurchaseOrderUseCase {
  constructor(private readonly purchaseOrders: IPurchaseOrderRepository) {}

  async execute(input: GetPurchaseOrderRequest): Promise<GetPurchaseOrderResult> {
    void input.staffUserId;
    const purchaseOrder = await this.purchaseOrders.findById(input.purchaseOrderId);
    if (purchaseOrder === null) {
      return { ok: false, reason: "not_found" };
    }
    return { ok: true, purchaseOrder };
  }
}
