import type { IUncoveredCaseQtyReadPort, IUncoveredListQuery } from "@dc-inventory/inventory";
import {
  OrganizationId,
  type PurchaseOrderId,
  type StaffUserId,
  type SupplierId,
} from "@dc-inventory/shared-kernel";
import { DraftPurchaseOrdersAbortError } from "../domain/errors.js";
import type { IPurchasingUnitOfWork } from "../domain/ports/purchase-order-repository.js";
import type { ICatalogSkuLookupPort } from "../domain/ports/supplier-product-repository.js";
import type { ISupplierSkuMappingReadPort } from "../domain/ports/supplier-sku-mapping.js";
import { draftPoQtyFromUncovered } from "./draft-po-qty-from-uncovered.js";
import { groupUncoveredSkusBySupplier } from "./group-uncovered-skus-by-supplier.js";
import { ReplacePurchaseOrderLinesUseCase } from "./replace-purchase-order-lines.js";

export type SyncDraftPurchaseOrdersFromUncoveredRequest = {
  organizationId: OrganizationId;
  staffUserId: StaffUserId;
  supplierIds?: readonly SupplierId[];
};

export type SyncDraftPurchaseOrdersFromUncoveredResult =
  | {
      ok: true;
      purchaseOrderIds: readonly PurchaseOrderId[];
      syncedSupplierIds: readonly SupplierId[];
      clearedSupplierIds: readonly SupplierId[];
      unmappedSkus: readonly string[];
    }
  | { ok: false; reason: "invalid" };

function sortLinesBySku<T extends { sku: { value: string } }>(lines: readonly T[]): T[] {
  return [...lines].sort((left, right) => left.sku.value.localeCompare(right.sku.value));
}

export class SyncDraftPurchaseOrdersFromUncoveredUseCase {
  constructor(
    private readonly uow: IPurchasingUnitOfWork,
    private readonly supplierMapping: ISupplierSkuMappingReadPort,
    private readonly uncoveredList: IUncoveredListQuery,
    private readonly caseQty: IUncoveredCaseQtyReadPort,
    private readonly catalog: ICatalogSkuLookupPort,
  ) {}

  async execute(
    input: SyncDraftPurchaseOrdersFromUncoveredRequest,
  ): Promise<SyncDraftPurchaseOrdersFromUncoveredResult> {
    const allUncovered = await this.uncoveredList.listAll({
      organizationId: input.organizationId,
    });
    const skus = allUncovered.map((row) => row.sku);
    const [mappings, packaging] = await Promise.all([
      this.supplierMapping.getSkuMappings(input.organizationId, skus),
      this.caseQty.readBySkus(input.organizationId, skus),
    ]);

    const grouped = groupUncoveredSkusBySupplier({
      lines: allUncovered.map((row) => ({
        sku: row.sku,
        qty: draftPoQtyFromUncovered(
          row.uncovered,
          packaging.get(row.sku.value)?.caseQty ?? null,
        ),
      })),
      supplierForSku: (sku) => {
        const mapping = mappings.get(sku.value);
        return mapping?.status === "mapped" ? mapping.supplierId : null;
      },
    });

    const supplierFilter =
      input.supplierIds !== undefined && input.supplierIds.length > 0
        ? input.supplierIds
        : undefined;

    const drafts = await this.uow.purchaseOrders.listNewestDraftsBySuppliers({
      organizationId: input.organizationId,
      supplierIds: supplierFilter,
    });

    if (drafts.length === 0) {
      return {
        ok: true,
        purchaseOrderIds: [],
        syncedSupplierIds: [],
        clearedSupplierIds: [],
        unmappedSkus: grouped.unmappedSkus,
      };
    }

    try {
      const result = await this.uow.run(async (scope) => {
        const replaceLines = new ReplacePurchaseOrderLinesUseCase(
          scope.purchaseOrders,
          this.catalog,
        );
        const purchaseOrderIds: PurchaseOrderId[] = [];
        const syncedSupplierIds: SupplierId[] = [];
        const clearedSupplierIds: SupplierId[] = [];

        for (const draft of drafts) {
          const supplierLines = sortLinesBySku(grouped.bySupplier.get(draft.supplierId) ?? []);

          if (supplierLines.length === 0) {
            const cleared = { ...draft, lines: [] };
            await scope.purchaseOrders.save(cleared);
            purchaseOrderIds.push(cleared.id);
            clearedSupplierIds.push(draft.supplierId);
            continue;
          }

          const replaced = await replaceLines.execute({
            organizationId: input.organizationId,
            staffUserId: input.staffUserId,
            purchaseOrderId: draft.id,
            lines: supplierLines.map((line) => ({
              sku: line.sku.value,
              qty: line.qty,
            })),
          });
          if (!replaced.ok) {
            throw new DraftPurchaseOrdersAbortError("invalid", grouped.unmappedSkus);
          }
          purchaseOrderIds.push(replaced.purchaseOrder.id);
          syncedSupplierIds.push(draft.supplierId);
        }

        return {
          purchaseOrderIds,
          syncedSupplierIds,
          clearedSupplierIds,
        };
      });

      return {
        ok: true,
        ...result,
        unmappedSkus: grouped.unmappedSkus,
      };
    } catch (error) {
      if (error instanceof DraftPurchaseOrdersAbortError) {
        return { ok: false, reason: "invalid" };
      }
      throw error;
    }
  }
}
