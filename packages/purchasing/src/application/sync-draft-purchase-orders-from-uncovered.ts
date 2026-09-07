import type {
  IUncoveredCaseQtyReadPort,
  IUncoveredListQuery,
} from "@dc-inventory/inventory";
import {
  OrganizationId,
  type Sku,
  type StaffUserId,
  type SupplierId,
} from "@dc-inventory/shared-kernel";
import type { IPurchaseOrderRepository } from "../domain/ports/purchase-order-repository.js";
import type { IInventoryUncoveredReadPort } from "../domain/ports/short-readout.js";
import type { ISupplierSkuMappingReadPort } from "../domain/ports/supplier-sku-mapping.js";
import type { PurchaseOrder } from "../domain/purchase-order.js";
import { draftPoQtyFromUncovered } from "./draft-po-qty-from-uncovered.js";
import { ReplacePurchaseOrderLinesUseCase } from "./replace-purchase-order-lines.js";

export type SyncDraftPurchaseOrdersFromUncoveredRequest = {
  organizationId: OrganizationId;
  staffUserId: StaffUserId;
  supplierIds?: readonly SupplierId[];
};

export type SyncDraftPurchaseOrdersFromUncoveredResult =
  | { ok: true; purchaseOrders: readonly PurchaseOrder[] }
  | { ok: false; reason: "invalid" };

/**
 * When multiple draft POs exist for the same supplier, only the newest
 * (`createdAt`) is synced. Older drafts for that supplier are left unchanged.
 */
function pickNewestDraftPerSupplier(
  drafts: readonly PurchaseOrder[],
): ReadonlyMap<SupplierId, PurchaseOrder> {
  const bySupplier = new Map<SupplierId, PurchaseOrder>();
  for (const draft of drafts) {
    const existing = bySupplier.get(draft.supplierId);
    if (existing === undefined || draft.createdAt > existing.createdAt) {
      bySupplier.set(draft.supplierId, draft);
    }
  }
  return bySupplier;
}

export class SyncDraftPurchaseOrdersFromUncoveredUseCase {
  constructor(
    private readonly purchaseOrders: IPurchaseOrderRepository,
    private readonly supplierMapping: ISupplierSkuMappingReadPort,
    private readonly uncoveredList: IUncoveredListQuery,
    private readonly caseQty: IUncoveredCaseQtyReadPort,
    private readonly inventoryUncovered: IInventoryUncoveredReadPort,
    private readonly replaceLines: ReplacePurchaseOrderLinesUseCase,
  ) {}

  async execute(
    input: SyncDraftPurchaseOrdersFromUncoveredRequest,
  ): Promise<SyncDraftPurchaseOrdersFromUncoveredResult> {
    const draftPage = await this.purchaseOrders.list({
      organizationId: input.organizationId,
      page: 1,
      pageSize: 10_000,
      status: "draft",
    });

    let drafts = draftPage.items;
    if (input.supplierIds !== undefined && input.supplierIds.length > 0) {
      const allowed = new Set(input.supplierIds);
      drafts = drafts.filter((order) => allowed.has(order.supplierId));
    }

    const newestBySupplier = pickNewestDraftPerSupplier(drafts);
    if (newestBySupplier.size === 0) {
      return { ok: true, purchaseOrders: [] };
    }

    const allUncovered = await this.uncoveredList.listAll({
      organizationId: input.organizationId,
    });
    const skus = allUncovered.map((row) => row.sku);
    const [mappings, packaging] = await Promise.all([
      this.supplierMapping.getSkuMappings(input.organizationId, skus),
      this.caseQty.readBySkus(input.organizationId, skus),
    ]);

    const synced: PurchaseOrder[] = [];

    for (const [supplierId, draft] of newestBySupplier) {
      const supplierSkus = allUncovered
        .filter((row) => {
          const mapping = mappings.get(row.sku.value);
          return mapping?.status === "mapped" && mapping.supplierId === supplierId;
        })
        .map((row) => row.sku)
        .sort((left, right) => left.value.localeCompare(right.value));

      if (supplierSkus.length === 0) {
        const cleared: PurchaseOrder = { ...draft, lines: [] };
        await this.purchaseOrders.save(cleared);
        synced.push(cleared);
        continue;
      }

      const lines = await Promise.all(
        supplierSkus.map(async (sku: Sku) => {
          const uncovered = await this.inventoryUncovered.getUncovered(
            input.organizationId,
            sku,
          );
          const caseQty = packaging.get(sku.value)?.caseQty ?? null;
          return {
            sku: sku.value,
            qty: draftPoQtyFromUncovered(uncovered, caseQty),
          };
        }),
      );

      const replaced = await this.replaceLines.execute({
        organizationId: input.organizationId,
        staffUserId: input.staffUserId,
        purchaseOrderId: draft.id,
        lines,
      });

      if (replaced.ok) {
        synced.push(replaced.purchaseOrder);
      }
    }

    return { ok: true, purchaseOrders: synced };
  }
}
