import { CustomerId, Money, OrderId, Sku } from "@dc-inventory/shared-kernel";
import { eq } from "drizzle-orm";
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

function toOrder(header: typeof orders.$inferSelect, lines: SalesOrderLine[]): SalesOrder {
  return {
    id: OrderId.parse(header.id),
    customerId: CustomerId.parse(header.customerId),
    documentNumber: header.documentNumber,
    status: header.status,
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
    const rows = await this.db.select().from(orders);
    const filtered = [];
    for (const row of rows) {
      if (query.status !== undefined && row.status !== query.status) {
        continue;
      }
      if (query.customerId !== undefined && row.customerId !== query.customerId) {
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

  async findById(id: OrderId): Promise<SalesOrder | null> {
    const rows = await this.db.select().from(orders).where(eq(orders.id, id)).limit(1);
    const header = rows[0];
    if (header === undefined) {
      return null;
    }
    const lines = await loadLines(this.db, header.id);
    return toOrder(header, lines);
  }

  async findByDocumentNumber(documentNumber: string): Promise<SalesOrder | null> {
    const rows = await this.db
      .select()
      .from(orders)
      .where(eq(orders.documentNumber, documentNumber))
      .limit(1);
    const header = rows[0];
    if (header === undefined) {
      return null;
    }
    const lines = await loadLines(this.db, header.id);
    return toOrder(header, lines);
  }

  async save(order: SalesOrder): Promise<void> {
    const existing = await this.findById(order.id);
    if (existing === null) {
      await this.db.insert(orders).values({
        id: order.id,
        customerId: order.customerId,
        status: order.status,
        documentNumber: order.documentNumber,
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

  async nextDocumentNumber(): Promise<string> {
    const rows = await this.db.select({ documentNumber: orders.documentNumber }).from(orders);
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
