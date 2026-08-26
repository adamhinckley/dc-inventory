import { OrganizationId, PurchaseOrderId, Sku, SupplierId } from "@dc-inventory/shared-kernel";
import { and, eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { formatDocumentNumber, parseDocumentSequence } from "../domain/document-number.js";
import { PurchaseOrderLineId } from "../domain/ids.js";
import type {
  IPurchaseOrderRepository,
  ListPurchaseOrdersQuery,
  PurchaseOrderListPage,
} from "../domain/ports/purchase-order-repository.js";
import type { PurchaseOrder, PurchaseOrderLine } from "../domain/purchase-order.js";
import {
  purchaseOrderLines,
  purchaseOrders,
  suppliers,
} from "../persistence/schema.js";

export type PurchasingDrizzle = PostgresJsDatabase<{
  purchaseOrders: typeof purchaseOrders;
  purchaseOrderLines: typeof purchaseOrderLines;
  suppliers: typeof suppliers;
}>;

function toLine(row: typeof purchaseOrderLines.$inferSelect): PurchaseOrderLine {
  return {
    id: PurchaseOrderLineId.parse(row.id),
    sku: Sku.parse(row.sku),
    name: row.name,
    qty: row.qty,
    receivedQty: row.receivedQty,
  };
}

async function loadLines(
  db: PurchasingDrizzle,
  purchaseOrderId: string,
): Promise<PurchaseOrderLine[]> {
  const rows = await db
    .select()
    .from(purchaseOrderLines)
    .where(eq(purchaseOrderLines.purchaseOrderId, purchaseOrderId));
  return rows.map(toLine);
}

function toOrder(
  header: typeof purchaseOrders.$inferSelect,
  lines: PurchaseOrderLine[],
): PurchaseOrder {
  return {
    id: PurchaseOrderId.parse(header.id),
    organizationId: OrganizationId.parse(header.organizationId),
    supplierId: SupplierId.parse(header.supplierId),
    documentNumber: header.documentNumber,
    status: header.status,
    createdAt: header.createdAt,
    lines,
  };
}

export class DrizzlePurchaseOrderRepository implements IPurchaseOrderRepository {
  constructor(private readonly db: PurchasingDrizzle) {}

  async list(query: ListPurchaseOrdersQuery): Promise<PurchaseOrderListPage> {
    const rows = await this.db
      .select()
      .from(purchaseOrders)
      .where(eq(purchaseOrders.organizationId, query.organizationId));
    const filtered = [];
    for (const row of rows) {
      if (query.status !== undefined && row.status !== query.status) {
        continue;
      }
      if (query.supplierId !== undefined && row.supplierId !== query.supplierId) {
        continue;
      }
      const lines = await loadLines(this.db, row.id);
      filtered.push(toOrder(row, lines));
    }
    filtered.sort((a, b) => a.documentNumber.localeCompare(b.documentNumber));
    const start = (query.page - 1) * query.pageSize;
    return {
      items: filtered.slice(start, start + query.pageSize),
      total: filtered.length,
    };
  }

  async findById(organizationId: OrganizationId, id: PurchaseOrderId): Promise<PurchaseOrder | null> {
    const rows = await this.db
      .select()
      .from(purchaseOrders)
      .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.organizationId, organizationId)))
      .limit(1);
    const header = rows[0];
    if (header === undefined) {
      return null;
    }
    const lines = await loadLines(this.db, header.id);
    return toOrder(header, lines);
  }

  async findByDocumentNumber(
    organizationId: OrganizationId,
    documentNumber: string,
  ): Promise<PurchaseOrder | null> {
    const rows = await this.db
      .select()
      .from(purchaseOrders)
      .where(
        and(
          eq(purchaseOrders.organizationId, organizationId),
          eq(purchaseOrders.documentNumber, documentNumber),
        ),
      )
      .limit(1);
    const header = rows[0];
    if (header === undefined) {
      return null;
    }
    const lines = await loadLines(this.db, header.id);
    return toOrder(header, lines);
  }

  async save(order: PurchaseOrder): Promise<void> {
    const existing = await this.findById(order.organizationId, order.id);
    if (existing === null) {
      await this.db.insert(purchaseOrders).values({
        id: order.id,
        organizationId: order.organizationId,
        supplierId: order.supplierId,
        status: order.status,
        documentNumber: order.documentNumber,
        createdAt: order.createdAt,
      });
      for (const line of order.lines) {
        await this.db.insert(purchaseOrderLines).values({
          id: line.id,
          purchaseOrderId: order.id,
          sku: line.sku.value,
          name: line.name,
          qty: line.qty,
          receivedQty: line.receivedQty,
        });
      }
      return;
    }

    await this.db
      .update(purchaseOrders)
      .set({
        supplierId: order.supplierId,
        status: order.status,
        documentNumber: order.documentNumber,
        updatedAt: new Date(),
      })
      .where(eq(purchaseOrders.id, order.id));

    for (const line of order.lines) {
      const lineRows = await this.db
        .select()
        .from(purchaseOrderLines)
        .where(eq(purchaseOrderLines.id, line.id))
        .limit(1);
      if (lineRows[0] === undefined) {
        await this.db.insert(purchaseOrderLines).values({
          id: line.id,
          purchaseOrderId: order.id,
          sku: line.sku.value,
          name: line.name,
          qty: line.qty,
          receivedQty: line.receivedQty,
        });
      } else {
        await this.db
          .update(purchaseOrderLines)
          .set({
            sku: line.sku.value,
            name: line.name,
            qty: line.qty,
            receivedQty: line.receivedQty,
            updatedAt: new Date(),
          })
          .where(eq(purchaseOrderLines.id, line.id));
      }
    }
  }

  async nextDocumentNumber(organizationId: OrganizationId): Promise<string> {
    const rows = await this.db
      .select({ documentNumber: purchaseOrders.documentNumber })
      .from(purchaseOrders)
      .where(eq(purchaseOrders.organizationId, organizationId));
    let max = 0;
    for (const row of rows) {
      const sequence = parseDocumentSequence(row.documentNumber);
      if (sequence !== null && sequence > max) {
        max = sequence;
      }
    }
    return formatDocumentNumber(max + 1);
  }
}
