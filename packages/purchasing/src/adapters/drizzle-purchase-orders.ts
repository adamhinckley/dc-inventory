import { OrganizationId, PurchaseOrderId, Sku, SupplierId } from "@dc-inventory/shared-kernel";
import { and, asc, count, desc, eq, ilike, inArray, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { formatDocumentNumber, parseDocumentSequence } from "../domain/document-number.js";
import { PurchaseOrderLineId } from "../domain/ids.js";
import type {
  IPurchaseOrderRepository,
  ListPurchaseOrdersQuery,
  PurchaseOrderListPage,
  UnnumberedPurchaseOrder,
} from "../domain/ports/purchase-order-repository.js";
import type { PurchaseOrder, PurchaseOrderLine } from "../domain/purchase-order.js";
import {
  documentNumberCounters,
  purchaseOrderLines,
  purchaseOrders,
} from "../persistence/schema.js";

export type PurchasingDrizzle = PostgresJsDatabase;

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

async function loadLinesByPurchaseOrderIds(
  db: PurchasingDrizzle,
  purchaseOrderIds: readonly string[],
): Promise<Map<string, PurchaseOrderLine[]>> {
  const byPurchaseOrderId = new Map<string, PurchaseOrderLine[]>();
  if (purchaseOrderIds.length === 0) {
    return byPurchaseOrderId;
  }
  const rows = await db
    .select()
    .from(purchaseOrderLines)
    .where(inArray(purchaseOrderLines.purchaseOrderId, [...purchaseOrderIds]))
    .orderBy(asc(purchaseOrderLines.purchaseOrderId), asc(purchaseOrderLines.id));
  for (const row of rows) {
    const lines = byPurchaseOrderId.get(row.purchaseOrderId) ?? [];
    lines.push(toLine(row));
    byPurchaseOrderId.set(row.purchaseOrderId, lines);
  }
  return byPurchaseOrderId;
}

async function findOrder(
  db: PurchasingDrizzle,
  organizationId: OrganizationId,
  id: PurchaseOrderId,
): Promise<PurchaseOrder | null> {
  const rows = await db
    .select()
    .from(purchaseOrders)
    .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.organizationId, organizationId)))
    .limit(1);
  const header = rows[0];
  if (header === undefined) {
    return null;
  }
  const lines = await loadLines(db, header.id);
  return toOrder(header, lines);
}

function purchaseOrderHeaderMatch(order: PurchaseOrder) {
  return and(
    eq(purchaseOrders.id, order.id),
    eq(purchaseOrders.organizationId, order.organizationId),
  );
}

function purchaseOrderLineMatch(purchaseOrderId: string, lineId: string) {
  return and(
    eq(purchaseOrderLines.id, lineId),
    eq(purchaseOrderLines.purchaseOrderId, purchaseOrderId),
  );
}

async function persistPurchaseOrder(db: PurchasingDrizzle, order: PurchaseOrder): Promise<void> {
  const existing = await findOrder(db, order.organizationId, order.id);
  if (existing === null) {
    await db.insert(purchaseOrders).values({
      id: order.id,
      organizationId: order.organizationId,
      supplierId: order.supplierId,
      status: order.status,
      documentNumber: order.documentNumber,
      shipDate: order.shipDate,
      cancelDate: order.cancelDate,
      createdAt: order.createdAt,
    });
    for (const line of order.lines) {
      await db.insert(purchaseOrderLines).values({
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

  await db
    .update(purchaseOrders)
    .set({
      supplierId: order.supplierId,
      status: order.status,
      documentNumber: order.documentNumber,
      shipDate: order.shipDate,
      cancelDate: order.cancelDate,
      updatedAt: new Date(),
    })
    .where(purchaseOrderHeaderMatch(order));

  const keepIds = new Set(order.lines.map((line) => line.id));
  for (const stale of existing.lines) {
    if (!keepIds.has(stale.id)) {
      await db
        .delete(purchaseOrderLines)
        .where(purchaseOrderLineMatch(order.id, stale.id));
    }
  }

  for (const line of order.lines) {
    const lineRows = await db
      .select()
      .from(purchaseOrderLines)
      .where(purchaseOrderLineMatch(order.id, line.id))
      .limit(1);
    if (lineRows[0] === undefined) {
      await db.insert(purchaseOrderLines).values({
        id: line.id,
        purchaseOrderId: order.id,
        sku: line.sku.value,
        name: line.name,
        qty: line.qty,
        receivedQty: line.receivedQty,
      });
    } else {
      await db
        .update(purchaseOrderLines)
        .set({
          sku: line.sku.value,
          name: line.name,
          qty: line.qty,
          receivedQty: line.receivedQty,
          updatedAt: new Date(),
        })
        .where(purchaseOrderLineMatch(order.id, line.id));
    }
  }
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
    shipDate: header.shipDate,
    cancelDate: header.cancelDate,
    createdAt: header.createdAt,
    lines,
  };
}

async function allocateDocumentNumber(
  db: PurchasingDrizzle,
  organizationId: OrganizationId,
): Promise<string> {
  const rows = await db
    .insert(documentNumberCounters)
    .values({ organizationId, lastValue: 1 })
    .onConflictDoUpdate({
      target: documentNumberCounters.organizationId,
      set: { lastValue: sql`${documentNumberCounters.lastValue} + 1` },
    })
    .returning({ sequence: documentNumberCounters.lastValue });
  const sequence = rows[0]?.sequence;
  if (sequence === undefined) {
    throw new Error("Failed to allocate purchase order document number");
  }
  return formatDocumentNumber(sequence);
}

async function advanceCounter(
  db: PurchasingDrizzle,
  organizationId: OrganizationId,
  documentNumber: string,
): Promise<void> {
  const sequence = parseDocumentSequence(documentNumber);
  if (sequence === null || sequence < 1) {
    return;
  }
  await db
    .insert(documentNumberCounters)
    .values({ organizationId, lastValue: sequence })
    .onConflictDoUpdate({
      target: documentNumberCounters.organizationId,
      set: {
        lastValue: sql`greatest(${documentNumberCounters.lastValue}, ${sequence})`,
      },
    });
}

export class DrizzlePurchaseOrderRepository implements IPurchaseOrderRepository {
  constructor(private readonly db: PurchasingDrizzle) {}

  async list(query: ListPurchaseOrdersQuery): Promise<PurchaseOrderListPage> {
    const clauses = [eq(purchaseOrders.organizationId, query.organizationId)];
    if (query.status !== undefined) {
      clauses.push(eq(purchaseOrders.status, query.status));
    }
    if (query.supplierId !== undefined) {
      clauses.push(eq(purchaseOrders.supplierId, query.supplierId));
    }
    if (query.q !== undefined && query.q.trim().length > 0) {
      clauses.push(ilike(purchaseOrders.documentNumber, `%${query.q.trim()}%`));
    }
    const where = and(...clauses);
    const offset = (query.page - 1) * query.pageSize;
    const sortColumn =
      query.sortBy === "status" ? purchaseOrders.status : purchaseOrders.documentNumber;
    const order = query.sortOrder === "desc" ? desc(sortColumn) : asc(sortColumn);
    const [totalRows, headers] = await Promise.all([
      this.db.select({ value: count() }).from(purchaseOrders).where(where),
      this.db
        .select()
        .from(purchaseOrders)
        .where(where)
        .orderBy(order, asc(purchaseOrders.id))
        .limit(query.pageSize)
        .offset(offset),
    ]);
    const lines = await loadLinesByPurchaseOrderIds(
      this.db,
      headers.map((header) => header.id),
    );
    return {
      items: headers.map((header) => toOrder(header, lines.get(header.id) ?? [])),
      total: totalRows[0]?.value ?? 0,
    };
  }

  async findById(organizationId: OrganizationId, id: PurchaseOrderId): Promise<PurchaseOrder | null> {
    return findOrder(this.db, organizationId, id);
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
    await this.db.transaction(async (tx) => {
      const transactionalDb = tx as PurchasingDrizzle;
      await advanceCounter(
        transactionalDb,
        order.organizationId,
        order.documentNumber,
      );
      await persistPurchaseOrder(transactionalDb, order);
    });
  }

  async insertWithNextDocumentNumber(
    order: UnnumberedPurchaseOrder,
  ): Promise<PurchaseOrder> {
    return this.db.transaction(async (tx) => {
      const transactionalDb = tx as PurchasingDrizzle;
      const documentNumber = await allocateDocumentNumber(
        transactionalDb,
        order.organizationId,
      );
      const numbered = { ...order, documentNumber };
      await persistPurchaseOrder(transactionalDb, numbered);
      return numbered;
    });
  }
}
