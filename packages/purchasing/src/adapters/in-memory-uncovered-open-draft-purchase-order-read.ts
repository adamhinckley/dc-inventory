import {
  OrganizationId,
  PurchaseOrderId,
  Sku,
  SupplierId,
} from "@dc-inventory/shared-kernel";
import type { IPurchaseOrderRepository } from "../domain/ports/purchase-order-repository.js";
import {
  uncoveredOpenDraftKey,
  type IUncoveredOpenDraftPurchaseOrderReadPort,
  type UncoveredOpenDraftPurchaseOrderRef,
  type UncoveredOpenDraftSupplierSku,
} from "../domain/ports/uncovered-open-draft-purchase-order-read.js";

export class InMemoryUncoveredOpenDraftPurchaseOrderReadPort
  implements IUncoveredOpenDraftPurchaseOrderReadPort
{
  constructor(private readonly purchaseOrders: IPurchaseOrderRepository) {}

  async findOpenDraftForSupplierSku(
    organizationId: OrganizationId,
    supplierId: SupplierId,
    sku: Sku,
  ): Promise<UncoveredOpenDraftPurchaseOrderRef | null> {
    const refs = await this.findOpenDraftsForSupplierSkus(organizationId, [
      { supplierId, sku },
    ]);
    return refs.get(uncoveredOpenDraftKey(supplierId, sku)) ?? null;
  }

  async findOpenDraftsForSupplierSkus(
    organizationId: OrganizationId,
    rows: readonly UncoveredOpenDraftSupplierSku[],
  ): Promise<ReadonlyMap<string, UncoveredOpenDraftPurchaseOrderRef>> {
    const refs = new Map<string, UncoveredOpenDraftPurchaseOrderRef>();
    if (rows.length === 0) {
      return refs;
    }

    const page = await this.purchaseOrders.list({
      organizationId,
      page: 1,
      pageSize: 10_000,
      status: "draft",
    });

    for (const row of rows) {
      const key = uncoveredOpenDraftKey(row.supplierId, row.sku);
      if (refs.has(key)) {
        continue;
      }
      const match = page.items.find(
        (order) =>
          order.supplierId === row.supplierId &&
          order.status === "draft" &&
          order.lines.some((line) => line.sku.value === row.sku.value),
      );
      if (match !== undefined) {
        refs.set(key, {
          id: PurchaseOrderId.parse(match.id),
          documentNumber: match.documentNumber,
        });
      }
    }

    return refs;
  }
}
