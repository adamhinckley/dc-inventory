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
import { and, eq, sql } from "drizzle-orm";
import type { PurchasingDrizzle } from "@dc-inventory/purchasing";
import type {
  UncoveredOpenDraftPurchaseOrderRef,
  UncoveredOpenDraftSupplierSku,
} from "@dc-inventory/purchasing";

function draftKey(supplierId: SupplierId, sku: Sku): string {
  return `${supplierId}:${sku.value}`;
}

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

    const pairValues = sql.join(
      rows.map((row) => sql`(${row.supplierId}, ${row.sku.value})`),
      sql`, `,
    );

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
          sql`(${purchaseOrders.supplierId}, ${purchaseOrderLines.sku}) in (values ${pairValues})`,
        ),
      );

    const draftByKey = new Map<string, UncoveredOpenDraftPurchaseOrderRef>();
    for (const row of draftRows) {
      const key = `${row.supplierId}:${row.sku}`;
      if (draftByKey.has(key)) {
        continue;
      }
      draftByKey.set(key, {
        id: PurchaseOrderId.parse(row.id),
        documentNumber: row.documentNumber,
      });
    }

    for (const row of rows) {
      const key = draftKey(row.supplierId, row.sku);
      if (refs.has(key)) {
        continue;
      }
      const match = draftByKey.get(key);
      if (match !== undefined) {
        refs.set(key, match);
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
      return refs.get(draftKey(supplierId, sku)) ?? null;
    },
    findOpenDraftsForSupplierSkus,
  };
}

export function inMemoryUncoveredOpenDraftPurchaseOrderReadPort(
  purchaseOrderRepo: IPurchaseOrderRepository,
): IUncoveredOpenDraftPurchaseOrderReadPort {
  return new InMemoryUncoveredOpenDraftPurchaseOrderReadPort(purchaseOrderRepo);
}
