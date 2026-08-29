import { CustomerId, Money, OrderId, OrganizationId, Sku } from "@dc-inventory/shared-kernel";
import { and, asc, count, eq, inArray } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { formatDocumentNumber, parseDocumentSequence } from "../domain/document-number.js";
import { SalesOrderLineId } from "../domain/ids.js";
import type {
  ISalesOrderRepository,
  ListSalesOrdersQuery,
  SalesOrderListPage,
} from "../domain/ports/sales-order-repository.js";
import type { SalesOrder, SalesOrderLine } from "../domain/sales-order.js";
import { orderLines, orders } from "../persistence/schema.js";

export type SalesDrizzle = PostgresJsDatabase<{
  orders: typeof orders;
  orderLines: typeof orderLines;
}>;

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
    shipLine1: header.shipLine1 ?? undefined,
    shipLine2: header.shipLine2,
    shipCity: header.shipCity ?? undefined,
    shipRegion: header.shipRegion ?? undefined,
    shipPostal: header.shipPostal ?? undefined,
    shipCountry: header.shipCountry ?? undefined,
  };
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
    const where = and(...clauses);
    const offset = (query.page - 1) * query.pageSize;
    const [totalRows, headers] = await Promise.all([
      this.db.select({ value: count() }).from(orders).where(where),
      this.db
        .select()
        .from(orders)
        .where(where)
        .orderBy(asc(orders.documentNumber), asc(orders.id))
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

  async save(order: SalesOrder): Promise<void> {
    const existing = await this.findById(order.organizationId, order.id);
    if (existing === null) {
      await this.db.insert(orders).values({
        id: order.id,
        organizationId: order.organizationId,
        customerId: order.customerId,
        status: order.status,
        documentNumber: order.documentNumber,
        createdAt: order.createdAt,
        shipLine1: order.shipLine1,
        shipLine2: order.shipLine2,
        shipCity: order.shipCity,
        shipRegion: order.shipRegion,
        shipPostal: order.shipPostal,
        shipCountry: order.shipCountry,
      });
      for (const line of order.lines) {
        await this.db.insert(orderLines).values({
          id: line.id,
          orderId: order.id,
          sku: line.sku.value,
          name: line.name,
          qty: line.qty,
          unitPriceCents: line.unitPrice.amountMinor,
          currency: line.unitPrice.currency,
          taxCategoryCode: line.taxCategoryCode,
        });
      }
      return;
    }

    await this.db
      .update(orders)
      .set({
        customerId: order.customerId,
        status: order.status,
        documentNumber: order.documentNumber,
        shipLine1: order.shipLine1,
        shipLine2: order.shipLine2,
        shipCity: order.shipCity,
        shipRegion: order.shipRegion,
        shipPostal: order.shipPostal,
        shipCountry: order.shipCountry,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, order.id));

    for (const line of order.lines) {
      const lineRows = await this.db
        .select()
        .from(orderLines)
        .where(eq(orderLines.id, line.id))
        .limit(1);
      if (lineRows[0] === undefined) {
        await this.db.insert(orderLines).values({
          id: line.id,
          orderId: order.id,
          sku: line.sku.value,
          name: line.name,
          qty: line.qty,
          unitPriceCents: line.unitPrice.amountMinor,
          currency: line.unitPrice.currency,
          taxCategoryCode: line.taxCategoryCode,
        });
      } else {
        await this.db
          .update(orderLines)
          .set({
            sku: line.sku.value,
            name: line.name,
            qty: line.qty,
            unitPriceCents: line.unitPrice.amountMinor,
            currency: line.unitPrice.currency,
            taxCategoryCode: line.taxCategoryCode,
            updatedAt: new Date(),
          })
          .where(eq(orderLines.id, line.id));
      }
    }
  }

  async nextDocumentNumber(organizationId: OrganizationId): Promise<string> {
    const rows = await this.db
      .select({ documentNumber: orders.documentNumber })
      .from(orders)
      .where(eq(orders.organizationId, organizationId));
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
