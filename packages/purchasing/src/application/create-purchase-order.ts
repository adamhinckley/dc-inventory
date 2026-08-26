import {
  OrganizationId,
  PurchaseOrderId,
  Sku,
  SupplierId,
  type StaffUserId,
} from "@dc-inventory/shared-kernel";
import type { IClock } from "../domain/clock.js";
import { newUuid, PurchaseOrderLineId } from "../domain/ids.js";
import type { IPurchaseOrderRepository, ISupplierRepository } from "../domain/ports/purchase-order-repository.js";
import type { PurchaseOrder, PurchaseOrderLine } from "../domain/purchase-order.js";

export type CreatePurchaseOrderLineInput = {
  sku: string;
  name: string;
  qty: number;
};

export type CreatePurchaseOrderRequest = {
  organizationId: OrganizationId;
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
    private readonly clock?: IClock,
  ) {}

  async execute(input: CreatePurchaseOrderRequest): Promise<CreatePurchaseOrderResult> {
    void input.staffUserId;
    if (input.lines.length === 0) {
      return { ok: false, reason: "empty_order" };
    }

    const supplier = await this.suppliers.findById(input.organizationId, input.supplierId);
    if (supplier === null) {
      return { ok: false, reason: "supplier_not_found" };
    }

    const lines: PurchaseOrderLine[] = [];
    const seenSkus = new Set<string>();
    for (const line of input.lines) {
      const name = line.name.trim();
      if (name.length === 0 || !Number.isInteger(line.qty) || line.qty <= 0) {
        return { ok: false, reason: "invalid" };
      }
      try {
        const sku = Sku.parse(line.sku);
        if (seenSkus.has(sku.value)) {
          return { ok: false, reason: "invalid" };
        }
        seenSkus.add(sku.value);
        lines.push({
          id: PurchaseOrderLineId.parse(newUuid()),
          sku,
          name,
          qty: line.qty,
          receivedQty: 0,
        });
      } catch {
        return { ok: false, reason: "invalid" };
      }
    }

    const createdAt = this.clock?.now() ?? new Date();
    const documentNumber = await this.purchaseOrders.nextDocumentNumber(input.organizationId);
    const purchaseOrder: PurchaseOrder = {
      id: PurchaseOrderId.parse(newUuid()),
      organizationId: input.organizationId,
      supplierId: input.supplierId,
      documentNumber,
      status: "draft",
      createdAt,
      lines,
    };
    await this.purchaseOrders.save(purchaseOrder);
    return { ok: true, purchaseOrder };
  }
}
