import { OrganizationId, PurchaseOrderId, Sku, SupplierId } from "@dc-inventory/shared-kernel";
import { and, asc, count, desc, eq, ilike, inArray, isNotNull, isNull, ne, notInArray, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import {
  collectOccupiedDocumentPrefixes,
  formatDocumentNumber,
  parseDocumentNumber,
  resolveDocumentPoPrefix,
} from "../domain/document-number.js";
import { PurchaseOrderLineId } from "../domain/ids.js";
import { parsePoPrefix } from "../domain/supplier.js";
import type {
  IPurchaseOrderRepository,
  ListNewestDraftsBySuppliersQuery,
  ListPurchaseOrdersQuery,
  PurchaseOrderListPage,
  PurchaseOrderListSortBy,
  UnnumberedPurchaseOrder,
} from "../domain/ports/purchase-order-repository.js";
import type { PurchaseOrder, PurchaseOrderLine } from "../domain/purchase-order.js";
import {
  purchaseOrderLines,
  purchaseOrders,
  supplierPoDocumentNumberCounters,
  suppliers,
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

async function orderExists(
  db: PurchasingDrizzle,
  organizationId: OrganizationId,
  id: PurchaseOrderId,
): Promise<boolean> {
  const rows = await db
    .select({ id: purchaseOrders.id })
    .from(purchaseOrders)
    .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.organizationId, organizationId)))
    .limit(1);
  return rows.length > 0;
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

function headerValues(order: PurchaseOrder) {
  return {
    id: order.id,
    organizationId: order.organizationId,
    supplierId: order.supplierId,
    status: order.status,
    documentNumber: order.documentNumber,
    shipDate: order.shipDate,
    cancelDate: order.cancelDate,
    createdAt: order.createdAt,
  };
}

function lineValues(order: PurchaseOrder) {
  return order.lines.map((line) => ({
    id: line.id,
    purchaseOrderId: order.id,
    sku: line.sku.value,
    name: line.name,
    qty: line.qty,
    receivedQty: line.receivedQty,
  }));
}

async function replacePurchaseOrderLines(
  db: PurchasingDrizzle,
  order: PurchaseOrder,
): Promise<void> {
  const nextLineIds = order.lines.map((line) => line.id);
  if (nextLineIds.length === 0) {
    await db.delete(purchaseOrderLines).where(eq(purchaseOrderLines.purchaseOrderId, order.id));
    return;
  }

  await db
    .delete(purchaseOrderLines)
    .where(
      and(
        eq(purchaseOrderLines.purchaseOrderId, order.id),
        notInArray(purchaseOrderLines.id, nextLineIds),
      ),
    );

  await db
    .insert(purchaseOrderLines)
    .values(lineValues(order))
    .onConflictDoUpdate({
      target: purchaseOrderLines.id,
      set: {
        sku: sql`excluded.sku`,
        name: sql`excluded.name`,
        qty: sql`excluded.qty`,
        receivedQty: sql`excluded.received_qty`,
        updatedAt: new Date(),
      },
    });
}

async function persistPurchaseOrder(db: PurchasingDrizzle, order: PurchaseOrder): Promise<void> {
  const updated = await db
    .update(purchaseOrders)
    .set({
      supplierId: order.supplierId,
      status: order.status,
      documentNumber: order.documentNumber,
      shipDate: order.shipDate,
      cancelDate: order.cancelDate,
      updatedAt: new Date(),
    })
    .where(purchaseOrderHeaderMatch(order))
    .returning({ id: purchaseOrders.id });

  if (updated.length === 0) {
    await db.insert(purchaseOrders).values(headerValues(order));
    if (order.lines.length > 0) {
      await db.insert(purchaseOrderLines).values(lineValues(order));
    }
    return;
  }

  await replacePurchaseOrderLines(db, order);
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

async function loadSupplierPoPrefix(
  db: PurchasingDrizzle,
  organizationId: OrganizationId,
  supplierId: SupplierId,
): Promise<string> {
  const currentRows = await db
    .select({ poPrefix: suppliers.poPrefix })
    .from(suppliers)
    .where(and(eq(suppliers.organizationId, organizationId), eq(suppliers.id, supplierId)))
    .limit(1);
  const currentPrefix = currentRows[0]?.poPrefix;
  const parsed = parsePoPrefix(currentPrefix);
  if (parsed !== null && parsed !== "invalid") {
    return parsed;
  }

  const [otherSuppliersWithPrefix, suppliersWithoutPrefix] = await Promise.all([
    db
      .select({ id: suppliers.id, poPrefix: suppliers.poPrefix })
      .from(suppliers)
      .where(
        and(
          eq(suppliers.organizationId, organizationId),
          isNotNull(suppliers.poPrefix),
          ne(suppliers.id, supplierId),
        ),
      ),
    db
      .select({ id: suppliers.id })
      .from(suppliers)
      .where(
        and(
          eq(suppliers.organizationId, organizationId),
          isNull(suppliers.poPrefix),
          ne(suppliers.id, supplierId),
        ),
      ),
  ]);
  const occupied = collectOccupiedDocumentPrefixes([
    ...otherSuppliersWithPrefix.map((row) => ({ id: row.id, poPrefix: row.poPrefix })),
    ...suppliersWithoutPrefix.map((row) => ({ id: row.id, poPrefix: null })),
  ]);
  return resolveDocumentPoPrefix(currentPrefix, supplierId, occupied);
}

async function allocateDocumentNumber(
  db: PurchasingDrizzle,
  organizationId: OrganizationId,
  supplierId: SupplierId,
  poPrefix: string,
): Promise<string> {
  const rows = await db
    .insert(supplierPoDocumentNumberCounters)
    .values({ organizationId, supplierId, lastValue: 1 })
    .onConflictDoUpdate({
      target: [
        supplierPoDocumentNumberCounters.organizationId,
        supplierPoDocumentNumberCounters.supplierId,
      ],
      set: { lastValue: sql`${supplierPoDocumentNumberCounters.lastValue} + 1` },
    })
    .returning({ sequence: supplierPoDocumentNumberCounters.lastValue });
  const sequence = rows[0]?.sequence;
  if (sequence === undefined) {
    throw new Error("Failed to allocate purchase order document number");
  }
  return formatDocumentNumber(poPrefix, sequence);
}

async function advanceCounter(
  db: PurchasingDrizzle,
  organizationId: OrganizationId,
  supplierId: SupplierId,
  documentNumber: string,
): Promise<void> {
  const parsed = parseDocumentNumber(documentNumber);
  if (parsed === null) {
    return;
  }
  await db
    .insert(supplierPoDocumentNumberCounters)
    .values({ organizationId, supplierId, lastValue: parsed.sequence })
    .onConflictDoUpdate({
      target: [
        supplierPoDocumentNumberCounters.organizationId,
        supplierPoDocumentNumberCounters.supplierId,
      ],
      set: {
        lastValue: sql`greatest(${supplierPoDocumentNumberCounters.lastValue}, ${parsed.sequence})`,
      },
    });
}

function purchaseOrderListSortColumn(sortBy: PurchaseOrderListSortBy) {
  switch (sortBy) {
    case "status":
      return purchaseOrders.status;
    case "shipDate":
      return purchaseOrders.shipDate;
    case "cancelDate":
      return purchaseOrders.cancelDate;
    case "supplierName":
      return suppliers.name;
    default:
      return purchaseOrders.documentNumber;
  }
}

export class DrizzlePurchaseOrderRepository implements IPurchaseOrderRepository {
  constructor(private readonly db: PurchasingDrizzle) {}

  async listNewestDraftsBySuppliers(
    query: ListNewestDraftsBySuppliersQuery,
  ): Promise<readonly PurchaseOrder[]> {
    const clauses = [
      eq(purchaseOrders.organizationId, query.organizationId),
      eq(purchaseOrders.status, "draft"),
    ];
    if (query.supplierIds !== undefined && query.supplierIds.length > 0) {
      clauses.push(inArray(purchaseOrders.supplierId, [...query.supplierIds]));
    }
    const headers = await this.db
      .selectDistinctOn([purchaseOrders.supplierId], { header: purchaseOrders })
      .from(purchaseOrders)
      .where(and(...clauses))
      .orderBy(asc(purchaseOrders.supplierId), desc(purchaseOrders.createdAt));
    const lines = await loadLinesByPurchaseOrderIds(
      this.db,
      headers.map((row) => row.header.id),
    );
    return headers.map((row) => toOrder(row.header, lines.get(row.header.id) ?? []));
  }

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
    const sortBy = query.sortBy ?? "documentNumber";
    const supplierJoin = eq(purchaseOrders.supplierId, suppliers.id);

    const [totalRows, headers] =
      sortBy === "remaining"
        ? await this.listByRemainingQty(where, query, offset, supplierJoin)
        : await this.listWithSortColumn(where, query, offset, supplierJoin, sortBy);
    const lines = await loadLinesByPurchaseOrderIds(
      this.db,
      headers.map((row) => row.header.id),
    );
    return {
      items: headers.map((row) => toOrder(row.header, lines.get(row.header.id) ?? [])),
      total: totalRows[0]?.value ?? 0,
    };
  }

  private async listWithSortColumn(
    where: ReturnType<typeof and>,
    query: ListPurchaseOrdersQuery,
    offset: number,
    supplierJoin: ReturnType<typeof eq>,
    sortBy: PurchaseOrderListSortBy,
  ) {
    const sortColumn = purchaseOrderListSortColumn(sortBy);
    const order = query.sortOrder === "desc" ? desc(sortColumn) : asc(sortColumn);
    return Promise.all([
      this.db.select({ value: count() }).from(purchaseOrders).where(where),
      this.db
        .select({ header: purchaseOrders })
        .from(purchaseOrders)
        .leftJoin(suppliers, supplierJoin)
        .where(where)
        .orderBy(order, asc(purchaseOrders.id))
        .limit(query.pageSize)
        .offset(offset),
    ]);
  }

  private async listByRemainingQty(
    where: ReturnType<typeof and>,
    query: ListPurchaseOrdersQuery,
    offset: number,
    supplierJoin: ReturnType<typeof eq>,
  ) {
    const remainingByPo = this.db
      .select({
        purchaseOrderId: purchaseOrderLines.purchaseOrderId,
        remainingQty: sql<number>`sum(${purchaseOrderLines.qty} - ${purchaseOrderLines.receivedQty})`.as(
          "remaining_qty",
        ),
      })
      .from(purchaseOrderLines)
      .groupBy(purchaseOrderLines.purchaseOrderId)
      .as("remaining_by_po");
    const remainingOrder =
      query.sortOrder === "desc"
        ? desc(sql`coalesce(${remainingByPo.remainingQty}, 0)`)
        : asc(sql`coalesce(${remainingByPo.remainingQty}, 0)`);
    return Promise.all([
      this.db.select({ value: count() }).from(purchaseOrders).where(where),
      this.db
        .select({ header: purchaseOrders })
        .from(purchaseOrders)
        .leftJoin(suppliers, supplierJoin)
        .leftJoin(remainingByPo, eq(remainingByPo.purchaseOrderId, purchaseOrders.id))
        .where(where)
        .orderBy(remainingOrder, asc(purchaseOrders.id))
        .limit(query.pageSize)
        .offset(offset),
    ]);
  }

  async findById(organizationId: OrganizationId, id: PurchaseOrderId): Promise<PurchaseOrder | null> {
    return findOrder(this.db, organizationId, id);
  }

  async exists(organizationId: OrganizationId, id: PurchaseOrderId): Promise<boolean> {
    return orderExists(this.db, organizationId, id);
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
        order.supplierId,
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
      const poPrefix = await loadSupplierPoPrefix(
        transactionalDb,
        order.organizationId,
        order.supplierId,
      );
      const documentNumber = await allocateDocumentNumber(
        transactionalDb,
        order.organizationId,
        order.supplierId,
        poPrefix,
      );
      const numbered = { ...order, documentNumber };
      await persistPurchaseOrder(transactionalDb, numbered);
      return numbered;
    });
  }
}
