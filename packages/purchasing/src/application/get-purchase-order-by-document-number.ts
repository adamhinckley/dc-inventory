import { OrganizationId, type StaffUserId } from "@dc-inventory/shared-kernel";
import type { IPurchaseOrderRepository } from "../domain/ports/purchase-order-repository.js";
import type { PurchaseOrder } from "../domain/purchase-order.js";

export type GetPurchaseOrderByDocumentNumberRequest = {
  organizationId: OrganizationId;
  staffUserId: StaffUserId;
  documentNumber: string;
};

export type GetPurchaseOrderByDocumentNumberResult =
  | { ok: true; purchaseOrder: PurchaseOrder }
  | { ok: false; reason: "not_found" };

export class GetPurchaseOrderByDocumentNumberUseCase {
  constructor(private readonly purchaseOrders: IPurchaseOrderRepository) {}

  async execute(
    input: GetPurchaseOrderByDocumentNumberRequest,
  ): Promise<GetPurchaseOrderByDocumentNumberResult> {
    void input.staffUserId;
    const purchaseOrder = await this.purchaseOrders.findByDocumentNumber(
      input.organizationId,
      input.documentNumber,
    );
    if (purchaseOrder === null) {
      return { ok: false, reason: "not_found" };
    }
    return { ok: true, purchaseOrder };
  }
}
