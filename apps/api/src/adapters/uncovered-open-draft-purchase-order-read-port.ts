import {
  InMemoryUncoveredOpenDraftPurchaseOrderReadPort,
  type IPurchaseOrderRepository,
  type IUncoveredOpenDraftPurchaseOrderReadPort,
} from "@dc-inventory/purchasing";
import {
  purchaseOrderLines,
  purchaseOrders,
} from "@dc-inventory/purchasing/schema";
import {
  OrganizationId,
  PurchaseOrderId,
  Sku,
  SupplierId,
} from "@dc-inventory/shared-kernel";
import { and, eq } from "drizzle-orm";
import type { PurchasingDrizzle } from "@dc-inventory/purchasing";
import type {
  UncoveredOpenDraftPurchaseOrderRef,
  UncoveredOpenDraftSupplierSku,
} from "@dc-inventory/purchasing";

export function uncoveredOpenDraftPurchaseOrderReadPort(
  db: PurchasingDrizzle,
): IUncoveredOpenDraftPurchaseOrderReadPort {
  async function findOpenDraftsForSupplierSkus(
    organizationId: OrganizationId,
    rows: readonly UncoveredOpenDraftSupplierSku[],
  ): Promise<ReadonlyMap<string, UncoveredOpenDraftPurchaseOrderRef>> {
    const refs = new Map<string, UncoveredOpenDraftPurchaseOrderRef>();
    if (rows.length === 0) {
      return refs;
    }

    const draftRows = await db
      .select({
        id: purchaseOrders.id,
        supplierId: purchaseOrders.supplierId,
        documentNumber: purchaseOrders.documentNumber,
        sku: purchaseOrderLines.sku,
      })
      .from(purchaseOrders)
      .innerJoin(purchaseOrderLines, eq(purchaseOrderLines.purchaseOrderId, purchaseOrders.id))
      .where(
        and(
          eq(purchaseOrders.organizationId, organizationId),
          eq(purchaseOrders.status, "draft"),
        ),
      );

    for (const row of rows) {
      const key = `${row.supplierId}:${row.sku.value}`;
      if (refs.has(key)) {
        continue;
      }
      const match = draftRows.find(
        (draft) =>
          draft.supplierId === row.supplierId && draft.sku === row.sku.value,
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

  return {
    async findOpenDraftForSupplierSku(
      organizationId: OrganizationId,
      supplierId: SupplierId,
      sku: Sku,
    ) {
      const refs = await findOpenDraftsForSupplierSkus(organizationId, [{ supplierId, sku }]);
      return refs.get(`${supplierId}:${sku.value}`) ?? null;
    },
    findOpenDraftsForSupplierSkus,
  };
}

export function inMemoryUncoveredOpenDraftPurchaseOrderReadPort(
  purchaseOrderRepo: IPurchaseOrderRepository,
): IUncoveredOpenDraftPurchaseOrderReadPort {
  return new InMemoryUncoveredOpenDraftPurchaseOrderReadPort(purchaseOrderRepo);
}
