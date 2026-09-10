import type { IUncoveredCaseQtyReadPort } from "@dc-inventory/inventory";
import { OrganizationId, Sku, type StaffUserId } from "@dc-inventory/shared-kernel";
import type { IClock } from "../domain/clock.js";
import { DraftPurchaseOrdersAbortError } from "../domain/errors.js";
import type { PurchaseOrder } from "../domain/purchase-order.js";
import type { IPurchasingUnitOfWork } from "../domain/ports/purchase-order-repository.js";
import type { ICatalogSkuLookupPort } from "../domain/ports/supplier-product-repository.js";
import type { IInventoryUncoveredReadPort } from "../domain/ports/short-readout.js";
import type { ISupplierSkuMappingReadPort } from "../domain/ports/supplier-sku-mapping.js";
import {
  CreatePurchaseOrderUseCase,
  type CreatePurchaseOrderResult,
} from "./create-purchase-order.js";
import { draftPoQtyFromUncovered } from "./draft-po-qty-from-uncovered.js";
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
    private readonly uow: IPurchasingUnitOfWork,
    private readonly catalog: ICatalogSkuLookupPort,
    private readonly clock?: IClock,
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

    const [mappings, packaging, uncoveredBySku] = await Promise.all([
      this.supplierMapping.getSkuMappings(input.organizationId, skus),
      this.caseQty.readBySkus(input.organizationId, skus),
      this.inventoryUncovered.getUncoveredBySkus(input.organizationId, skus),
    ]);

    const draftLines = skus.map((sku) => {
      const uncovered = uncoveredBySku.get(sku.value) ?? 0;
      const caseQty = packaging.get(sku.value)?.caseQty ?? null;
      return {
        sku,
        qty: draftPoQtyFromUncovered(uncovered, caseQty),
      };
    });

    const grouped = groupUncoveredSkusBySupplier({
      lines: draftLines,
      supplierForSku: (sku) => mappings.get(sku.value)?.supplierId ?? null,
    });

    try {
      const purchaseOrders = await this.uow.run(async (scope) => {
        const createPurchaseOrder = new CreatePurchaseOrderUseCase(
          scope.purchaseOrders,
          scope.suppliers,
          this.catalog,
          this.clock,
        );
        const createdOrders: PurchaseOrder[] = [];
        for (const [supplierId, lines] of grouped.bySupplier) {
          const created = await createPurchaseOrder.execute({
            organizationId: input.organizationId,
            staffUserId: input.staffUserId,
            supplierId,
            lines: lines.map((line) => ({
              sku: line.sku.value,
              qty: line.qty,
            })),
          });
          if (!created.ok) {
            throw new DraftPurchaseOrdersAbortError("invalid", grouped.unmappedSkus);
          }
          createdOrders.push(created.purchaseOrder);
        }
        return createdOrders;
      });

      return {
        ok: true,
        purchaseOrders,
        unmappedSkus: grouped.unmappedSkus,
      };
    } catch (error) {
      if (error instanceof DraftPurchaseOrdersAbortError) {
        return {
          ok: false,
          reason: error.reason,
          unmappedSkus: error.unmappedSkus,
        };
      }
      throw error;
    }
  }
}

export type { CreatePurchaseOrderResult };
