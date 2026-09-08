import {
  OrganizationId,
  PurchaseOrderId,
  Sku,
  SupplierId,
  type StaffUserId,
} from "@dc-inventory/shared-kernel";
import type { IClock } from "../domain/clock.js";
import { parseIsoDate } from "../domain/iso-date.js";
import { newUuid, PurchaseOrderLineId } from "../domain/ids.js";
import type { IPurchaseOrderRepository, ISupplierRepository } from "../domain/ports/purchase-order-repository.js";
import type { ICatalogSkuLookupPort } from "../domain/ports/supplier-product-repository.js";
import { parsePoPrefix } from "../domain/supplier.js";
import type { PurchaseOrder, PurchaseOrderLine } from "../domain/purchase-order.js";

export type CreatePurchaseOrderLineInput = {
  sku: string;
  /**
   * Accepted for wire compatibility only. Catalog supplies the frozen line name.
   */
  name?: string;
  qty: number;
};

export type CreatePurchaseOrderRequest = {
  organizationId: OrganizationId;
  staffUserId: StaffUserId;
  supplierId: SupplierId;
  shipDate?: string | null;
  cancelDate?: string | null;
  lines: readonly CreatePurchaseOrderLineInput[];
};

export type CreatePurchaseOrderResult =
  | { ok: true; purchaseOrder: PurchaseOrder }
  | {
      ok: false;
      reason:
        | "invalid"
        | "supplier_not_found"
        | "supplier_po_prefix_missing"
        | "product_not_found"
        | "product_archived"
        | "empty_order";
    };

export class CreatePurchaseOrderUseCase {
  constructor(
    private readonly purchaseOrders: IPurchaseOrderRepository,
    private readonly suppliers: ISupplierRepository,
    private readonly catalog: ICatalogSkuLookupPort,
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
    if (parsePoPrefix(supplier.poPrefix) === null) {
      return { ok: false, reason: "supplier_po_prefix_missing" };
    }

    const lines: PurchaseOrderLine[] = [];
    const seenSkus = new Set<string>();
    for (const line of input.lines) {
      if (!Number.isInteger(line.qty) || line.qty <= 0) {
        return { ok: false, reason: "invalid" };
      }
      try {
        const requestedSku = Sku.parse(line.sku);
        const product = await this.catalog.findBySku(input.organizationId, requestedSku);
        if (product === null) {
          return { ok: false, reason: "product_not_found" };
        }
        if (product.archived) {
          return { ok: false, reason: "product_archived" };
        }
        const name = product.name.trim();
        if (name.length === 0 || seenSkus.has(product.sku.value)) {
          return { ok: false, reason: "invalid" };
        }
        seenSkus.add(product.sku.value);
        lines.push({
          id: PurchaseOrderLineId.parse(newUuid()),
          sku: product.sku,
          name,
          qty: line.qty,
          receivedQty: 0,
        });
      } catch {
        return { ok: false, reason: "invalid" };
      }
    }

    const shipDate = parseIsoDate(input.shipDate);
    const cancelDate = parseIsoDate(input.cancelDate);
    if (shipDate === "invalid" || cancelDate === "invalid") {
      return { ok: false, reason: "invalid" };
    }

    const createdAt = this.clock?.now() ?? new Date();
    const purchaseOrder = await this.purchaseOrders.insertWithNextDocumentNumber({
      id: PurchaseOrderId.parse(newUuid()),
      organizationId: input.organizationId,
      supplierId: input.supplierId,
      status: "draft",
      shipDate,
      cancelDate,
      createdAt,
      lines,
    });
    return { ok: true, purchaseOrder };
  }
}
