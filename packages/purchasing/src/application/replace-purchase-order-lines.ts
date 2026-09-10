import {
  OrganizationId,
  PurchaseOrderId,
  type StaffUserId,
} from "@dc-inventory/shared-kernel";
import type { IPurchaseOrderRepository } from "../domain/ports/purchase-order-repository.js";
import type { ICatalogSkuLookupPort } from "../domain/ports/supplier-product-repository.js";
import { parseIsoDate } from "../domain/iso-date.js";
import type { PurchaseOrder } from "../domain/purchase-order.js";
import { resolveDraftPurchaseOrderLines } from "./resolve-draft-purchase-order-lines.js";

export type ReplacePurchaseOrderLineInput = {
  sku: string;
  /**
   * Accepted for wire compatibility only. Catalog supplies the frozen line name.
   */
  name?: string;
  qty: number;
};

export type ReplacePurchaseOrderLinesRequest = {
  organizationId: OrganizationId;
  staffUserId: StaffUserId;
  purchaseOrderId: PurchaseOrderId;
  lines: readonly ReplacePurchaseOrderLineInput[];
  shipDate?: string | null;
  cancelDate?: string | null;
};

export type ReplacePurchaseOrderLinesResult =
  | { ok: true; purchaseOrder: PurchaseOrder }
  | {
      ok: false;
      reason:
        | "not_found"
        | "illegal_transition"
        | "empty_order"
        | "invalid"
        | "product_not_found"
        | "product_archived";
    };

export class ReplacePurchaseOrderLinesUseCase {
  constructor(
    private readonly purchaseOrders: IPurchaseOrderRepository,
    private readonly catalog: ICatalogSkuLookupPort,
  ) {}

  async execute(input: ReplacePurchaseOrderLinesRequest): Promise<ReplacePurchaseOrderLinesResult> {
    void input.staffUserId;
    if (input.lines.length === 0) {
      return { ok: false, reason: "empty_order" };
    }

    const existing = await this.purchaseOrders.findById(
      input.organizationId,
      input.purchaseOrderId,
    );
    if (existing === null) {
      return { ok: false, reason: "not_found" };
    }
    if (existing.status !== "draft") {
      return { ok: false, reason: "illegal_transition" };
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

    const shipDate =
      input.shipDate === undefined ? existing.shipDate : parseIsoDate(input.shipDate);
    const cancelDate =
      input.cancelDate === undefined ? existing.cancelDate : parseIsoDate(input.cancelDate);
    if (shipDate === "invalid" || cancelDate === "invalid") {
      return { ok: false, reason: "invalid" };
    }

    const updated: PurchaseOrder = {
      ...existing,
      shipDate,
      cancelDate,
      lines,
    };
    await this.purchaseOrders.save(updated);
    return { ok: true, purchaseOrder: updated };
  }
}
