import { OrganizationId, PurchaseOrderId, Sku, SupplierId } from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { DrizzlePurchaseOrderRepository } from "../src/adapters/drizzle-purchase-orders.js";
import { PurchaseOrderLineId } from "../src/domain/ids.js";
import type { PurchaseOrder, PurchaseOrderLine } from "../src/domain/purchase-order.js";
import {
  purchaseOrderLines,
  purchaseOrders,
  supplierPoDocumentNumberCounters,
  suppliers,
} from "../src/persistence/schema.js";

const ORG = OrganizationId.DEFAULT;
const PO_ID = PurchaseOrderId.parse("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01");
const SUPPLIER_ID = SupplierId.parse("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01");
const SKU = Sku.parse("PO-DRAFT-SKU");
const OTHER_SKU = Sku.parse("PO-OTHER-SKU");
const LINE_A = PurchaseOrderLineId.parse("cccccccc-cccc-4ccc-8ccc-cccccccccc01");
const LINE_B = PurchaseOrderLineId.parse("cccccccc-cccc-4ccc-8ccc-cccccccccc02");
const LINE_C = PurchaseOrderLineId.parse("cccccccc-cccc-4ccc-8ccc-cccccccccc03");
const FOREIGN_PO_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa99";
const FOREIGN_LINE = PurchaseOrderLineId.parse("cccccccc-cccc-4ccc-8ccc-cccccccccc99");

type OrderRow = {
  id: string;
  organizationId: string;
  supplierId: string;
  status: PurchaseOrder["status"];
  documentNumber: string;
  createdAt: Date;
  updatedAt?: Date;
};

type LineRow = {
  id: string;
  purchaseOrderId: string;
  sku: string;
  name: string;
  qty: number;
  receivedQty: number;
  updatedAt?: Date;
};

function isSql(node: unknown): node is { queryChunks: unknown[] } {
  return (
    typeof node === "object" &&
    node !== null &&
    "decoder" in node &&
    "queryChunks" in node &&
    Array.isArray((node as { queryChunks: unknown }).queryChunks)
  );
}

function isColumn(node: unknown): node is { name: string } {
  return typeof node === "object" && node !== null && "columnType" in node && "name" in node;
}

function isParam(node: unknown): node is { value: unknown } {
  return typeof node === "object" && node !== null && "encoder" in node && "value" in node;
}

function eqPairs(clause: unknown): Array<{ column: string; value: unknown }> {
  const pairs: Array<{ column: string; value: unknown }> = [];
  let pending: string | undefined;
  function walk(node: unknown): void {
    if (isColumn(node)) {
      pending = node.name;
      return;
    }
    if (isParam(node) && pending !== undefined) {
      pairs.push({ column: pending, value: node.value });
      pending = undefined;
      return;
    }
    if (isSql(node)) {
      for (const chunk of node.queryChunks) {
        walk(chunk);
      }
    }
  }
  walk(clause);
  return pairs;
}

function sqlNameToKey(column: string): string {
  return column.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function rowMatches(row: Record<string, unknown>, clause: unknown): boolean {
  return eqPairs(clause).every(({ column, value }) => row[sqlNameToKey(column)] === value);
}

function thenableRows<T>(rows: T[]) {
  return Object.assign(Promise.resolve(rows), {
    limit: (n: number) => Promise.resolve(rows.slice(0, n)),
  });
}

type SupplierRow = {
  id: string;
  organizationId: string;
  poPrefix: string | null;
};

class FakePurchasingDb {
  readonly orders = new Map<string, OrderRow>();
  readonly lines = new Map<string, LineRow>();
  readonly supplierRows = new Map<string, SupplierRow>();
  failNextLineInsert = false;

  constructor() {
    this.supplierRows.set(SUPPLIER_ID, {
      id: SUPPLIER_ID,
      organizationId: ORG,
      poPrefix: "HF",
    });
  }

  async transaction<T>(work: (tx: FakePurchasingDb) => Promise<T>): Promise<T> {
    const orderSnap = structuredClone([...this.orders.entries()]);
    const lineSnap = structuredClone([...this.lines.entries()]);
    try {
      return await work(this);
    } catch (error) {
      this.orders.clear();
      this.lines.clear();
      for (const [id, row] of orderSnap) {
        this.orders.set(id, row);
      }
      for (const [id, row] of lineSnap) {
        this.lines.set(id, row);
      }
      throw error;
    }
  }

  select() {
    return {
      from: (table: unknown) => ({
        where: (clause: unknown) => {
          if (table === purchaseOrders) {
            return thenableRows(
              [...this.orders.values()].filter((row) => rowMatches(row, clause)),
            );
          }
          if (table === suppliers) {
            return thenableRows(
              [...this.supplierRows.values()].filter((row) => rowMatches(row, clause)),
            );
          }
          return thenableRows(
            [...this.lines.values()].filter((row) => rowMatches(row, clause)),
          );
        },
      }),
    };
  }

  insert(table: unknown) {
    return {
      values: (value: OrderRow | LineRow | Array<OrderRow | LineRow>) => {
        if (table === supplierPoDocumentNumberCounters) {
          return {
            onConflictDoUpdate: async () => ({ sequence: 1 }),
            returning: async () => [{ sequence: 1 }],
          };
        }
        return (async () => {
          if (table === purchaseOrderLines && this.failNextLineInsert) {
            this.failNextLineInsert = false;
            throw new Error("forced line insert failure");
          }
          const rows = Array.isArray(value) ? value : [value];
          for (const row of rows) {
            if (table === purchaseOrders) {
              this.orders.set(row.id, { ...(row as OrderRow) });
            } else {
              this.lines.set(row.id, { ...(row as LineRow) });
            }
          }
        })();
      },
    };
  }

  update(table: unknown) {
    return {
      set: (patch: Record<string, unknown>) => ({
        where: async (clause: unknown) => {
          const target = table === purchaseOrders ? this.orders : this.lines;
          for (const [id, row] of target) {
            if (rowMatches(row as unknown as Record<string, unknown>, clause)) {
              target.set(id, { ...row, ...patch } as never);
            }
          }
        },
      }),
    };
  }

  delete(table: unknown) {
    return {
      where: async (clause: unknown) => {
        const target = table === purchaseOrders ? this.orders : this.lines;
        for (const [id, row] of target) {
          if (rowMatches(row as unknown as Record<string, unknown>, clause)) {
            target.delete(id);
          }
        }
      },
    };
  }
}

function line(id: PurchaseOrderLineId, sku: Sku, name: string, qty: number): PurchaseOrderLine {
  return { id, sku, name, qty, receivedQty: 0 };
}

function draft(lines: PurchaseOrderLine[]): PurchaseOrder {
  return {
    id: PO_ID,
    organizationId: ORG,
    supplierId: SUPPLIER_ID,
    documentNumber: "PO-HF-00099",
    status: "draft",
    shipDate: null,
    cancelDate: null,
    createdAt: new Date("2026-08-28T00:00:00.000Z"),
    lines,
  };
}

const FOREIGN_LINE_ROW: LineRow = {
  id: FOREIGN_LINE,
  purchaseOrderId: FOREIGN_PO_ID,
  sku: "FOREIGN-SKU",
  name: "Other PO line",
  qty: 99,
  receivedQty: 0,
};

function seedForeignLine(db: FakePurchasingDb): void {
  db.lines.set(FOREIGN_LINE, { ...FOREIGN_LINE_ROW });
}

describe("DrizzlePurchaseOrderRepository.save", () => {
  it("drops previous line rows when the saved line set uses new ids", async () => {
    const db = new FakePurchasingDb();
    const repo = new DrizzlePurchaseOrderRepository(db as never);

    await repo.save(draft([line(LINE_A, SKU, "Bolt", 5)]));
    seedForeignLine(db);
    await repo.save(
      draft([line(LINE_B, SKU, "Bolt updated", 8), line(LINE_C, OTHER_SKU, "Washer", 2)]),
    );

    const loaded = await repo.findById(ORG, PO_ID);
    expect(loaded?.lines.map((row) => row.id).sort()).toEqual([LINE_B, LINE_C].sort());
    expect(loaded?.lines.filter((row) => row.sku.equals(SKU))).toHaveLength(1);
    expect(db.lines.get(FOREIGN_LINE)).toEqual(FOREIGN_LINE_ROW);
  });

  it("rolls back stale line deletes when a later line insert fails", async () => {
    const db = new FakePurchasingDb();
    const repo = new DrizzlePurchaseOrderRepository(db as never);

    await repo.save(draft([line(LINE_A, SKU, "Bolt", 5)]));
    seedForeignLine(db);
    db.failNextLineInsert = true;

    await expect(
      repo.save(draft([line(LINE_B, SKU, "Bolt updated", 8)])),
    ).rejects.toThrow("forced line insert failure");

    const loaded = await repo.findById(ORG, PO_ID);
    expect(loaded?.lines.map((row) => row.id)).toEqual([LINE_A]);
    expect(loaded?.lines[0]?.qty).toBe(5);
    expect(db.lines.get(FOREIGN_LINE)).toEqual(FOREIGN_LINE_ROW);
  });

  it("saves existing POs without requiring a live supplier poPrefix", async () => {
    const db = new FakePurchasingDb();
    const repo = new DrizzlePurchaseOrderRepository(db as never);

    await repo.save(draft([line(LINE_A, SKU, "Bolt", 5)]));
    const supplier = db.supplierRows.get(SUPPLIER_ID);
    expect(supplier).toBeDefined();
    if (supplier !== undefined) {
      db.supplierRows.set(SUPPLIER_ID, { ...supplier, poPrefix: null });
    }

    await repo.save(draft([line(LINE_A, SKU, "Bolt updated", 8)]));
    const loaded = await repo.findById(ORG, PO_ID);
    expect(loaded?.lines[0]?.qty).toBe(8);
  });
});
