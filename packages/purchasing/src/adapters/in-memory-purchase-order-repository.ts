import {
  OrganizationId,
  PurchaseOrderId,
  Sku,
  SupplierId,
} from "@dc-inventory/shared-kernel";
import {
  collectOccupiedDocumentPrefixes,
  formatDocumentNumber,
  parseDocumentNumber,
  resolveDocumentPoPrefix,
} from "../domain/document-number.js";
import { PurchaseOrderLineId } from "../domain/ids.js";
import type {
  IPurchaseOrderRepository,
  ListPurchaseOrdersQuery,
  PurchaseOrderListPage,
  PurchaseOrderListSortBy,
  UnnumberedPurchaseOrder,
} from "../domain/ports/purchase-order-repository.js";
import type { PurchaseOrder, PurchaseOrderLine } from "../domain/purchase-order.js";

type Stored = { order: PurchaseOrder; createdAt: Date };

function supplierCounterKey(
  organizationId: OrganizationId,
  supplierId: SupplierId,
): string {
  return `${organizationId}:${supplierId}`;
}

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
    organizationId: OrganizationId.parse(order.organizationId),
    supplierId: SupplierId.parse(order.supplierId),
    documentNumber: order.documentNumber,
    status: order.status,
    shipDate: order.shipDate,
    cancelDate: order.cancelDate,
    createdAt: new Date(order.createdAt.getTime()),
    lines: order.lines.map(toLine),
  };
}

function remainingQty(order: PurchaseOrder): number {
  return order.lines.reduce((total, line) => total + (line.qty - line.receivedQty), 0);
}

function compareNullableDate(left: string | null, right: string | null): number {
  return (left ?? "").localeCompare(right ?? "");
}

function comparePurchaseOrderSort(
  left: { row: Stored; supplierName: string },
  right: { row: Stored; supplierName: string },
  sortBy: PurchaseOrderListSortBy,
): number {
  switch (sortBy) {
    case "status":
      return left.row.order.status.localeCompare(right.row.order.status);
    case "supplierName":
      return left.supplierName.localeCompare(right.supplierName);
    case "shipDate":
      return compareNullableDate(left.row.order.shipDate, right.row.order.shipDate);
    case "cancelDate":
      return compareNullableDate(left.row.order.cancelDate, right.row.order.cancelDate);
    case "remaining":
      return remainingQty(left.row.order) - remainingQty(right.row.order);
    default:
      return left.row.order.documentNumber.localeCompare(right.row.order.documentNumber);
  }
}

export class InMemoryPurchaseOrderRepository implements IPurchaseOrderRepository {
  private readonly byId = new Map<PurchaseOrderId, Stored>();
  private readonly nextSequenceBySupplier = new Map<string, number>();

  constructor(
    private readonly supplierName = async (
      _organizationId: OrganizationId,
      _supplierId: SupplierId,
    ): Promise<string> => "",
    private readonly supplierPoPrefix = async (
      _organizationId: OrganizationId,
      _supplierId: SupplierId,
    ): Promise<string | null> => null,
    private readonly listSuppliersInOrg = async (
      _organizationId: OrganizationId,
    ): Promise<readonly { id: SupplierId; poPrefix: string | null }[]> => [],
  ) {}

  async list(query: ListPurchaseOrdersQuery): Promise<PurchaseOrderListPage> {
    const needle = query.q?.trim().toLowerCase() ?? "";
    const rows = [...this.byId.values()].filter((row) => {
      if (row.order.organizationId !== query.organizationId) {
        return false;
      }
      if (query.status !== undefined && row.order.status !== query.status) {
        return false;
      }
      if (query.supplierId !== undefined && row.order.supplierId !== query.supplierId) {
        return false;
      }
      return needle.length === 0 || row.order.documentNumber.toLowerCase().includes(needle);
    });
    const withKeys = await Promise.all(
      rows.map(async (row) => ({
        row,
        supplierName: await this.supplierName(row.order.organizationId, row.order.supplierId),
      })),
    );
    const sortBy: PurchaseOrderListSortBy = query.sortBy ?? "documentNumber";
    withKeys.sort((a, b) => {
      const cmp = comparePurchaseOrderSort(a, b, sortBy);
      return query.sortOrder === "desc" ? -cmp : cmp;
    });
    const sortedRows = withKeys.map((entry) => entry.row);
    const start = (query.page - 1) * query.pageSize;
    return {
      items: sortedRows.slice(start, start + query.pageSize).map((row) => row.order),
      total: sortedRows.length,
    };
  }

  async findById(organizationId: OrganizationId, id: PurchaseOrderId): Promise<PurchaseOrder | null> {
    const row = this.byId.get(id);
    if (row === undefined || row.order.organizationId !== organizationId) {
      return null;
    }
    return row.order;
  }

  async findByDocumentNumber(
    organizationId: OrganizationId,
    documentNumber: string,
  ): Promise<PurchaseOrder | null> {
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

  private async requirePoPrefix(
    organizationId: OrganizationId,
    supplierId: SupplierId,
  ): Promise<string> {
    const poPrefix = await this.supplierPoPrefix(organizationId, supplierId);
    const suppliers = await this.listSuppliersInOrg(organizationId);
    const occupied = collectOccupiedDocumentPrefixes(
      suppliers.map((supplier) => ({ id: supplier.id, poPrefix: supplier.poPrefix })),
      supplierId,
    );
    return resolveDocumentPoPrefix(poPrefix, supplierId, occupied);
  }

  async save(order: PurchaseOrder): Promise<void> {
    const normalized = toOrder(order);
    const existing = this.byId.get(normalized.id);
    this.byId.set(normalized.id, {
      order: normalized,
      createdAt: existing?.createdAt ?? normalized.createdAt,
    });
    const parsed = parseDocumentNumber(normalized.documentNumber);
    if (parsed !== null) {
      const key = supplierCounterKey(normalized.organizationId, normalized.supplierId);
      const current = this.nextSequenceBySupplier.get(key) ?? 1;
      if (parsed.sequence >= current) {
        this.nextSequenceBySupplier.set(key, parsed.sequence + 1);
      }
    }
  }

  async insertWithNextDocumentNumber(
    order: UnnumberedPurchaseOrder,
  ): Promise<PurchaseOrder> {
    const poPrefix = await this.requirePoPrefix(order.organizationId, order.supplierId);
    const key = supplierCounterKey(order.organizationId, order.supplierId);
    const next = this.nextSequenceBySupplier.get(key) ?? 1;
    const numbered = { ...order, documentNumber: formatDocumentNumber(poPrefix, next) };
    await this.save(numbered);
    return toOrder(numbered);
  }

  snapshot(): {
    byId: Map<PurchaseOrderId, Stored>;
    nextSequenceBySupplier: Map<string, number>;
  } {
    return {
      byId: new Map(this.byId),
      nextSequenceBySupplier: new Map(this.nextSequenceBySupplier),
    };
  }

  restore(snapshot: {
    byId: Map<PurchaseOrderId, Stored>;
    nextSequenceBySupplier: Map<string, number>;
  }): void {
    this.byId.clear();
    for (const [id, row] of snapshot.byId) {
      this.byId.set(id, row);
    }
    this.nextSequenceBySupplier.clear();
    for (const [supplierKey, sequence] of snapshot.nextSequenceBySupplier) {
      this.nextSequenceBySupplier.set(supplierKey, sequence);
    }
  }
}
