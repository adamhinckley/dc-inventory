import type { IUncoveredCaseQtyReadPort } from "@dc-inventory/inventory";
import {
  OrganizationId,
  Sku,
  type StaffUserId,
  type SupplierId,
} from "@dc-inventory/shared-kernel";
import type { PurchaseOrder } from "../domain/purchase-order.js";
import type { IInventoryUncoveredReadPort } from "../domain/ports/short-readout.js";
import type { ISupplierSkuMappingReadPort } from "../domain/ports/supplier-sku-mapping.js";
import {
  CreatePurchaseOrderUseCase,
  type CreatePurchaseOrderResult,
} from "./create-purchase-order.js";
import { groupUncoveredSkusBySupplier } from "./group-uncovered-skus-by-supplier.js";

export type DraftPurchaseOrdersFromUncoveredSkusRequest = {
  organizationId: OrganizationId;
  staffUserId: StaffUserId;
  skus: readonly string[];
};

export type DraftPurchaseOrdersFromUncoveredSkusResult =
  | {
      ok: true;
      purchaseOrders: readonly PurchaseOrder[];
      unmappedSkus: readonly string[];
    }
  | {
      ok: false;
      reason: "invalid" | "empty_selection";
      unmappedSkus?: readonly string[];
    };

/**
 * Matches `suggestedDraftPoQty` in apps/internal purchase-order-line-math.
 * Ceil uncovered need to the next master pack when case qty exists.
 */
function draftPoQtyFromUncovered(need: number, caseQty: number | null): number {
  if (need <= 0) {
    return 1;
  }
  if (caseQty === null || caseQty <= 0) {
    return need;
  }
  return Math.ceil(need / caseQty) * caseQty;
}

function uniqueSkus(raw: readonly string[]): Sku[] {
  const parsed: Sku[] = [];
  const seen = new Set<string>();
  for (const value of raw) {
    try {
      const sku = Sku.parse(value);
      if (seen.has(sku.value)) {
        continue;
      }
      seen.add(sku.value);
      parsed.push(sku);
    } catch {
      return [];
    }
  }
  return parsed;
}

export class DraftPurchaseOrdersFromUncoveredSkusUseCase {
  constructor(
    private readonly supplierMapping: ISupplierSkuMappingReadPort,
    private readonly inventoryUncovered: IInventoryUncoveredReadPort,
    private readonly caseQty: IUncoveredCaseQtyReadPort,
    private readonly createPurchaseOrder: CreatePurchaseOrderUseCase,
  ) {}

  async execute(
    input: DraftPurchaseOrdersFromUncoveredSkusRequest,
  ): Promise<DraftPurchaseOrdersFromUncoveredSkusResult> {
    if (input.skus.length === 0) {
      return { ok: false, reason: "empty_selection" };
    }

    const skus = uniqueSkus(input.skus);
    if (skus.length === 0) {
      return { ok: false, reason: "invalid" };
    }

    const supplierBySku = new Map<string, SupplierId | null>();
    for (const sku of skus) {
      supplierBySku.set(
        sku.value,
        await this.supplierMapping.findSupplierForSku(input.organizationId, sku),
      );
    }

    const packaging = await this.caseQty.readBySkus(input.organizationId, skus);
    const draftLines = await Promise.all(
      skus.map(async (sku) => {
        const uncovered = await this.inventoryUncovered.getUncovered(
          input.organizationId,
          sku,
        );
        const caseQty = packaging.get(sku.value)?.caseQty ?? null;
        return {
          sku,
          qty: draftPoQtyFromUncovered(uncovered, caseQty),
        };
      }),
    );

    const grouped = groupUncoveredSkusBySupplier({
      lines: draftLines,
      supplierForSku: (sku) => supplierBySku.get(sku.value) ?? null,
    });

    const purchaseOrders: PurchaseOrder[] = [];
    for (const [supplierId, lines] of grouped.bySupplier) {
      const created = await this.createPurchaseOrder.execute({
        organizationId: input.organizationId,
        staffUserId: input.staffUserId,
        supplierId,
        lines: lines.map((line) => ({
          sku: line.sku.value,
          qty: line.qty,
        })),
      });
      if (!created.ok) {
        return {
          ok: false,
          reason: "invalid",
          unmappedSkus: grouped.unmappedSkus,
        };
      }
      purchaseOrders.push(created.purchaseOrder);
    }

    return {
      ok: true,
      purchaseOrders,
      unmappedSkus: grouped.unmappedSkus,
    };
  }
}

export type { CreatePurchaseOrderResult };
