import { CustomerId, Money, OrderId, OrganizationId, Sku, StaffUserId } from "@dc-inventory/shared-kernel";
import { and, asc, count, desc, eq, ilike, inArray, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { formatDocumentNumber, parseDocumentSequence } from "../domain/document-number.js";
import { SalesOrderLineId } from "../domain/ids.js";
import type {
  ISalesOrderRepository,
  ListSalesOrdersQuery,
  SalesOrderListPage,
  UnnumberedSalesOrder,
} from "../domain/ports/sales-order-repository.js";
import type { SalesOrder, SalesOrderLine } from "../domain/sales-order.js";
import { documentNumberCounters, orderLines, orders } from "../persistence/schema.js";

export type SalesDrizzle = PostgresJsDatabase;

function toLine(row: typeof orderLines.$inferSelect): SalesOrderLine {
  return {
    id: SalesOrderLineId.parse(row.id),
    sku: Sku.parse(row.sku),
    name: row.name,
    qty: row.qty,
    unitPrice: Money.fromMinorUnits(row.unitPriceCents, row.currency),
    taxCategoryCode: row.taxCategoryCode ?? undefined,
  };
}

async function loadLines(db: SalesDrizzle, orderId: string): Promise<SalesOrderLine[]> {
  const rows = await db.select().from(orderLines).where(eq(orderLines.orderId, orderId));
  return rows.map(toLine);
}

async function loadLinesByOrderIds(
  db: SalesDrizzle,
  orderIds: readonly string[],
): Promise<Map<string, SalesOrderLine[]>> {
  const byOrderId = new Map<string, SalesOrderLine[]>();
  if (orderIds.length === 0) {
    return byOrderId;
  }
  const rows = await db
    .select()
    .from(orderLines)
    .where(inArray(orderLines.orderId, [...orderIds]))
    .orderBy(asc(orderLines.orderId), asc(orderLines.id));
  for (const row of rows) {
    const lines = byOrderId.get(row.orderId) ?? [];
    lines.push(toLine(row));
    byOrderId.set(row.orderId, lines);
  }
  return byOrderId;
}

function toOrder(header: typeof orders.$inferSelect, lines: SalesOrderLine[]): SalesOrder {
  return {
    id: OrderId.parse(header.id),
    organizationId: OrganizationId.parse(header.organizationId),
    customerId: CustomerId.parse(header.customerId),
    documentNumber: header.documentNumber,
    status: header.status,
    createdAt: header.createdAt,
    lines,
    ...(header.label !== null ? { label: header.label } : {}),
    ...(header.placedByStaffUserId !== null
      ? { placedByStaffUserId: StaffUserId.parse(header.placedByStaffUserId) }
      : {}),
    ...(header.creditLimitOverriddenByStaffUserId !== null
      ? {
          creditLimitOverriddenByStaffUserId: StaffUserId.parse(
            header.creditLimitOverriddenByStaffUserId,
          ),
        }
      : {}),
    shipLine1: header.shipLine1 ?? undefined,
    shipLine2: header.shipLine2,
    shipCity: header.shipCity ?? undefined,
    shipRegion: header.shipRegion ?? undefined,
    shipPostal: header.shipPostal ?? undefined,
    shipCountry: header.shipCountry ?? undefined,
  };
}

async function allocateDocumentNumber(
  db: SalesDrizzle,
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
    throw new Error("Failed to allocate sales order document number");
  }
  return formatDocumentNumber(sequence);
}

async function advanceCounter(
  db: SalesDrizzle,
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

export class DrizzleSalesOrderRepository implements ISalesOrderRepository {
  constructor(private readonly db: SalesDrizzle) {}

  async list(query: ListSalesOrdersQuery): Promise<SalesOrderListPage> {
    const clauses = [eq(orders.organizationId, query.organizationId)];
    if (query.status !== undefined) {
      clauses.push(eq(orders.status, query.status));
    }
    if (query.customerId !== undefined) {
      clauses.push(eq(orders.customerId, query.customerId));
    }
    if (query.q !== undefined && query.q.trim().length > 0) {
      clauses.push(ilike(orders.documentNumber, `%${query.q.trim()}%`));
    }
    const where = and(...clauses);
    const offset = (query.page - 1) * query.pageSize;
    const sortColumn =
      query.sortBy === "status" ? orders.status : orders.documentNumber;
    const order = query.sortOrder === "desc" ? desc(sortColumn) : asc(sortColumn);
    const [totalRows, headers] = await Promise.all([
      this.db.select({ value: count() }).from(orders).where(where),
      this.db
        .select()
        .from(orders)
        .where(where)
        .orderBy(order, asc(orders.id))
        .limit(query.pageSize)
        .offset(offset),
    ]);
    const lines = await loadLinesByOrderIds(
      this.db,
      headers.map((header) => header.id),
    );
    return {
      items: headers.map((header) => toOrder(header, lines.get(header.id) ?? [])),
      total: totalRows[0]?.value ?? 0,
    };
  }

  async findById(organizationId: OrganizationId, id: OrderId): Promise<SalesOrder | null> {
    const rows = await this.db
      .select()
      .from(orders)
      .where(and(eq(orders.id, id), eq(orders.organizationId, organizationId)))
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
  ): Promise<SalesOrder | null> {
    const rows = await this.db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.organizationId, organizationId),
          eq(orders.documentNumber, documentNumber),
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

  async save(order: SalesOrder, existing?: SalesOrder | null): Promise<void> {
    await this.db.transaction(async (tx) => {
      const transactionalDb = tx as SalesDrizzle;
      await advanceCounter(
        transactionalDb,
        order.organizationId,
        order.documentNumber,
      );
      const repo = new DrizzleSalesOrderRepository(transactionalDb);
      const prior =
        existing !== undefined
          ? existing
          : await repo.findById(order.organizationId, order.id);
      await repo.persist(order, prior);
    });
  }

  async insertWithNextDocumentNumber(
    order: UnnumberedSalesOrder,
  ): Promise<SalesOrder> {
    return this.db.transaction(async (tx) => {
      const transactionalDb = tx as SalesDrizzle;
      const documentNumber = await allocateDocumentNumber(
        transactionalDb,
        order.organizationId,
      );
      const numbered = { ...order, documentNumber };
      await new DrizzleSalesOrderRepository(transactionalDb).persist(numbered, null);
      return numbered;
    });
  }

  private async persist(
    order: SalesOrder,
    existing: SalesOrder | null,
  ): Promise<void> {
    if (existing === null) {
      await this.db.insert(orders).values({
        id: order.id,
        organizationId: order.organizationId,
        customerId: order.customerId,
        status: order.status,
        documentNumber: order.documentNumber,
        label: order.label ?? null,
        createdAt: order.createdAt,
        placedByStaffUserId: order.placedByStaffUserId ?? null,
        creditLimitOverriddenByStaffUserId: order.creditLimitOverriddenByStaffUserId ?? null,
        shipLine1: order.shipLine1,
        shipLine2: order.shipLine2,
        shipCity: order.shipCity,
        shipRegion: order.shipRegion,
        shipPostal: order.shipPostal,
        shipCountry: order.shipCountry,
      });
      await this.replaceOrderLines(order);
      return;
    }

    await this.db
      .update(orders)
      .set({
        customerId: order.customerId,
        status: order.status,
        documentNumber: order.documentNumber,
        label: order.label ?? null,
        placedByStaffUserId: order.placedByStaffUserId ?? null,
        creditLimitOverriddenByStaffUserId: order.creditLimitOverriddenByStaffUserId ?? null,
        shipLine1: order.shipLine1,
        shipLine2: order.shipLine2,
        shipCity: order.shipCity,
        shipRegion: order.shipRegion,
        shipPostal: order.shipPostal,
        shipCountry: order.shipCountry,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, order.id));

    await this.replaceOrderLines(order);
  }

  private async replaceOrderLines(order: SalesOrder): Promise<void> {
    const nextLineIds = order.lines.map((line) => line.id);
    if (nextLineIds.length === 0) {
      await this.db.delete(orderLines).where(eq(orderLines.orderId, order.id));
      return;
    }

    await this.db
      .delete(orderLines)
      .where(
        and(
          eq(orderLines.orderId, order.id),
          sql`${orderLines.id} not in (${sql.join(
            nextLineIds.map((id) => sql`${id}`),
            sql`, `,
          )})`,
        ),
      );

    if (order.lines.length === 0) {
      return;
    }

    await this.db
      .insert(orderLines)
      .values(
        order.lines.map((line) => ({
          id: line.id,
          orderId: order.id,
          sku: line.sku.value,
          name: line.name,
          qty: line.qty,
          unitPriceCents: line.unitPrice.amountMinor,
          currency: line.unitPrice.currency,
          taxCategoryCode: line.taxCategoryCode,
        })),
      )
      .onConflictDoUpdate({
        target: orderLines.id,
        set: {
          sku: sql`excluded.sku`,
          name: sql`excluded.name`,
          qty: sql`excluded.qty`,
          unitPriceCents: sql`excluded.unit_price_cents`,
          currency: sql`excluded.currency`,
          taxCategoryCode: sql`excluded.tax_category_code`,
          updatedAt: new Date(),
        },
      });
  }
}
