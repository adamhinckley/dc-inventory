import { PurchaseOrderId, type StaffUserId } from "@dc-inventory/shared-kernel";
import type {
  IPurchaseOrderRepository,
  ISupplierRepository,
} from "../domain/ports/purchase-order-repository.js";
import type { PurchaseOrder } from "../domain/purchase-order.js";
import { labelsForSupplier } from "./purchase-order-supplier-labels.js";

export type GetPurchaseOrderRequest = {
  staffUserId: StaffUserId;
  purchaseOrderId: PurchaseOrderId;
};

export type GetPurchaseOrderResult =
  | {
      ok: true;
      purchaseOrder: PurchaseOrder;
      supplierName: string;
      supplierVendorNumber: string;
    }
  | { ok: false; reason: "not_found" };

export class GetPurchaseOrderUseCase {
  constructor(
    private readonly purchaseOrders: IPurchaseOrderRepository,
    private readonly suppliers: ISupplierRepository,
  ) {}

  async execute(input: GetPurchaseOrderRequest): Promise<GetPurchaseOrderResult> {
    void input.staffUserId;
    const purchaseOrder = await this.purchaseOrders.findById(input.purchaseOrderId);
    if (purchaseOrder === null) {
      return { ok: false, reason: "not_found" };
    }
    return {
      ok: true,
      purchaseOrder,
      ...(await labelsForSupplier(this.suppliers, purchaseOrder.supplierId)),
    };
  }
}
