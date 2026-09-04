import {
  CustomerId,
  Money,
  OrderId,
  OrganizationId,
  Sku,
  StaffUserId,
} from "@dc-inventory/shared-kernel";
import { formatDocumentNumber, parseDocumentSequence } from "../domain/document-number.js";
import { SalesOrderLineId } from "../domain/ids.js";
import type {
  ISalesOrderRepository,
  ListSalesOrdersQuery,
  SalesOrderListPage,
  UnnumberedSalesOrder,
} from "../domain/ports/sales-order-repository.js";
import type { SalesOrder, SalesOrderLine } from "../domain/sales-order.js";

type Stored = { order: SalesOrder; createdAt: Date };

function toLine(line: SalesOrderLine): SalesOrderLine {
  return {
    id: SalesOrderLineId.parse(line.id),
    sku: Sku.parse(line.sku.value),
    name: line.name,
    qty: line.qty,
    unitPrice: Money.fromMinorUnits(line.unitPrice.amountMinor, line.unitPrice.currency),
    taxCategoryCode: line.taxCategoryCode,
    ...(line.decommitted ? { decommitted: true as const } : {}),
  };
}

function toOrder(order: SalesOrder): SalesOrder {
  return {
    id: OrderId.parse(order.id),
    organizationId: OrganizationId.parse(order.organizationId),
    customerId: CustomerId.parse(order.customerId),
    documentNumber: order.documentNumber,
    status: order.status,
    createdAt: new Date(order.createdAt.getTime()),
    lines: order.lines.map(toLine),
    ...(order.placedByStaffUserId !== undefined
      ? { placedByStaffUserId: StaffUserId.parse(order.placedByStaffUserId) }
      : {}),
    shipLine1: order.shipLine1,
    shipLine2: order.shipLine2,
    shipCity: order.shipCity,
    shipRegion: order.shipRegion,
    shipPostal: order.shipPostal,
    shipCountry: order.shipCountry,
  };
}

export class InMemorySalesOrderRepository implements ISalesOrderRepository {
  private readonly byId = new Map<OrderId, Stored>();
  private readonly nextSequenceByOrg = new Map<string, number>();

  snapshot(): {
    byId: Map<OrderId, Stored>;
    nextSequenceByOrg: Map<string, number>;
  } {
    return {
      byId: new Map(this.byId),
      nextSequenceByOrg: new Map(this.nextSequenceByOrg),
    };
  }

  restore(snapshot: {
    byId: Map<OrderId, Stored>;
    nextSequenceByOrg: Map<string, number>;
  }): void {
    this.byId.clear();
    for (const [id, row] of snapshot.byId) {
      this.byId.set(id, row);
    }
    this.nextSequenceByOrg.clear();
    for (const [orgKey, sequence] of snapshot.nextSequenceByOrg) {
      this.nextSequenceByOrg.set(orgKey, sequence);
    }
  }

  async list(query: ListSalesOrdersQuery): Promise<SalesOrderListPage> {
    const needle = query.q?.trim().toLowerCase() ?? "";
    const rows = [...this.byId.values()].filter((row) => {
      if (row.order.organizationId !== query.organizationId) {
        return false;
      }
      if (query.status !== undefined && row.order.status !== query.status) {
        return false;
      }
      if (query.customerId !== undefined && row.order.customerId !== query.customerId) {
        return false;
      }
      return needle.length === 0 || row.order.documentNumber.toLowerCase().includes(needle);
    });
    rows.sort((a, b) => {
      const cmp =
        query.sortBy === "status"
          ? a.order.status.localeCompare(b.order.status)
          : a.order.documentNumber.localeCompare(b.order.documentNumber);
      return query.sortOrder === "desc" ? -cmp : cmp;
    });
    const start = (query.page - 1) * query.pageSize;
    return {
      items: rows.slice(start, start + query.pageSize).map((row) => row.order),
      total: rows.length,
    };
  }

  async findById(organizationId: OrganizationId, id: OrderId): Promise<SalesOrder | null> {
    const row = this.byId.get(id);
    if (row === undefined || row.order.organizationId !== organizationId) {
      return null;
    }
    return row.order;
  }

  async findByDocumentNumber(
    organizationId: OrganizationId,
    documentNumber: string,
  ): Promise<SalesOrder | null> {
    for (const row of this.byId.values()) {
      if (
        row.order.organizationId === organizationId &&
        row.order.documentNumber === documentNumber
      ) {
        return row.order;
      }
    }
    return null;
  }

  async save(order: SalesOrder): Promise<void> {
    const normalized = toOrder(order);
    const existing = this.byId.get(normalized.id);
    this.byId.set(normalized.id, {
      order: normalized,
      createdAt: existing?.createdAt ?? normalized.createdAt,
    });
    const sequence = parseDocumentSequence(normalized.documentNumber);
    if (sequence !== null) {
      const orgKey = normalized.organizationId;
      const current = this.nextSequenceByOrg.get(orgKey) ?? 1;
      if (sequence >= current) {
        this.nextSequenceByOrg.set(orgKey, sequence + 1);
      }
    }
  }

  async insertWithNextDocumentNumber(order: UnnumberedSalesOrder): Promise<SalesOrder> {
    const orgKey = order.organizationId;
    const next = this.nextSequenceByOrg.get(orgKey) ?? 1;
    const numbered = { ...order, documentNumber: formatDocumentNumber(next) };
    await this.save(numbered);
    return toOrder(numbered);
  }
}
