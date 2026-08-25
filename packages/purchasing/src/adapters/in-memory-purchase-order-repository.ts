import {
  PurchaseOrderId,
  Sku,
  SupplierId,
} from "@dc-inventory/shared-kernel";
import { formatDocumentNumber, parseDocumentSequence } from "../domain/document-number.js";
import { PurchaseOrderLineId } from "../domain/ids.js";
import type {
  IPurchaseOrderRepository,
  ListPurchaseOrdersQuery,
  PurchaseOrderListPage,
} from "../domain/ports/purchase-order-repository.js";
import type { PurchaseOrder, PurchaseOrderLine } from "../domain/purchase-order.js";

type Stored = { order: PurchaseOrder; createdAt: Date };

function toLine(line: PurchaseOrderLine): PurchaseOrderLine {
  return {
    id: PurchaseOrderLineId.parse(line.id),
    sku: Sku.parse(line.sku.value),
    name: line.name,
    qty: line.qty,
    receivedQty: line.receivedQty,
  };
}

function toOrder(order: PurchaseOrder): PurchaseOrder {
  return {
    id: PurchaseOrderId.parse(order.id),
    supplierId: SupplierId.parse(order.supplierId),
    documentNumber: order.documentNumber,
    status: order.status,
    createdAt: new Date(order.createdAt.getTime()),
    lines: order.lines.map(toLine),
  };
}

export class InMemoryPurchaseOrderRepository implements IPurchaseOrderRepository {
  private readonly byId = new Map<PurchaseOrderId, Stored>();
  private nextSequence = 1;

  async list(query: ListPurchaseOrdersQuery): Promise<PurchaseOrderListPage> {
    const rows = [...this.byId.values()].filter((row) => {
      if (query.status !== undefined && row.order.status !== query.status) {
        return false;
      }
      if (query.supplierId !== undefined && row.order.supplierId !== query.supplierId) {
        return false;
      }
      return true;
    });
    rows.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const start = (query.page - 1) * query.pageSize;
    return {
      items: rows.slice(start, start + query.pageSize).map((row) => row.order),
      total: rows.length,
    };
  }

  async findById(id: PurchaseOrderId): Promise<PurchaseOrder | null> {
    return this.byId.get(id)?.order ?? null;
  }

  async findByDocumentNumber(documentNumber: string): Promise<PurchaseOrder | null> {
    for (const row of this.byId.values()) {
      if (row.order.documentNumber === documentNumber) {
        return row.order;
      }
    }
    return null;
  }

  async save(order: PurchaseOrder): Promise<void> {
    const normalized = toOrder(order);
    const existing = this.byId.get(normalized.id);
    this.byId.set(normalized.id, {
      order: normalized,
      createdAt: existing?.createdAt ?? normalized.createdAt,
    });
    const sequence = parseDocumentSequence(normalized.documentNumber);
    if (sequence !== null && sequence >= this.nextSequence) {
      this.nextSequence = sequence + 1;
    }
  }

  async nextDocumentNumber(): Promise<string> {
    const number = formatDocumentNumber(this.nextSequence);
    this.nextSequence += 1;
    return number;
  }
}
