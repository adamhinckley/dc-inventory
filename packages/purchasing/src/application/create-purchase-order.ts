import {
  PurchaseOrderId,
  Sku,
  SupplierId,
  type StaffUserId,
} from "@dc-inventory/shared-kernel";
import { newUuid, PurchaseOrderLineId } from "../domain/ids.js";
import type { IPurchaseOrderRepository, ISupplierRepository } from "../domain/ports/purchase-order-repository.js";
import type { PurchaseOrder, PurchaseOrderLine } from "../domain/purchase-order.js";

export type CreatePurchaseOrderLineInput = {
  sku: string;
  name: string;
  qty: number;
};

export type CreatePurchaseOrderRequest = {
  staffUserId: StaffUserId;
  supplierId: SupplierId;
  lines: readonly CreatePurchaseOrderLineInput[];
};

export type CreatePurchaseOrderResult =
  | { ok: true; purchaseOrder: PurchaseOrder }
  | { ok: false; reason: "invalid" | "supplier_not_found" | "empty_order" };

export class CreatePurchaseOrderUseCase {
  constructor(
    private readonly purchaseOrders: IPurchaseOrderRepository,
    private readonly suppliers: ISupplierRepository,
  ) {}

  async execute(input: CreatePurchaseOrderRequest): Promise<CreatePurchaseOrderResult> {
    void input.staffUserId;
    if (input.lines.length === 0) {
      return { ok: false, reason: "empty_order" };
    }

    const supplier = await this.suppliers.findById(input.supplierId);
    if (supplier === null) {
      return { ok: false, reason: "supplier_not_found" };
    }

    const lines: PurchaseOrderLine[] = [];
    for (const line of input.lines) {
      const name = line.name.trim();
      if (name.length === 0 || !Number.isInteger(line.qty) || line.qty <= 0) {
        return { ok: false, reason: "invalid" };
      }
      try {
        lines.push({
          id: PurchaseOrderLineId.parse(newUuid()),
          sku: Sku.parse(line.sku),
          name,
          qty: line.qty,
          receivedQty: 0,
        });
      } catch {
        return { ok: false, reason: "invalid" };
      }
    }

    const documentNumber = await this.purchaseOrders.nextDocumentNumber();
    const purchaseOrder: PurchaseOrder = {
      id: PurchaseOrderId.parse(newUuid()),
      supplierId: input.supplierId,
      documentNumber,
      status: "draft",
      lines,
    };
    await this.purchaseOrders.save(purchaseOrder);
    return { ok: true, purchaseOrder };
  }
}
