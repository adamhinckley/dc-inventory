import {
  OrganizationId,
  PurchaseOrderId,
  SupplierId,
  type StaffUserId,
} from "@dc-inventory/shared-kernel";
import type { IClock } from "../domain/clock.js";
import { parseIsoDate } from "../domain/iso-date.js";
import { newUuid } from "../domain/ids.js";
import type { IPurchaseOrderRepository, ISupplierRepository } from "../domain/ports/purchase-order-repository.js";
import type { ICatalogSkuLookupPort } from "../domain/ports/supplier-product-repository.js";
import type { PurchaseOrder } from "../domain/purchase-order.js";
import { resolveDraftPurchaseOrderLines } from "./resolve-draft-purchase-order-lines.js";

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

    const resolved = await resolveDraftPurchaseOrderLines(
      this.catalog,
      input.organizationId,
      input.lines,
    );
    if (!resolved.ok) {
      return resolved;
    }
    const { lines } = resolved;

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
