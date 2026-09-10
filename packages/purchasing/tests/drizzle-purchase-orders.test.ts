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

function isValueChunk(node: unknown): node is { value: unknown } {
  return typeof node === "object" && node !== null && "value" in node && !("encoder" in node);
}

function walkQueryChunks(node: unknown, visit: (chunk: unknown) => void): void {
  if (isSql(node)) {
    for (const chunk of node.queryChunks) {
      walkQueryChunks(chunk, visit);
    }
    return;
  }
  if (typeof node === "object" && node !== null) {
    const numericKeys = Object.keys(node).filter((key) => /^\d+$/.test(key));
    if (numericKeys.length > 0) {
      for (const key of numericKeys) {
        walkQueryChunks((node as Record<string, unknown>)[key], visit);
      }
      return;
    }
  }
  visit(node);
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

function chunkText(node: unknown): string {
  if (typeof node === "string") {
    return node;
  }
  if (isValueChunk(node)) {
    if (typeof node.value === "string") {
      return node.value;
    }
    if (Array.isArray(node.value)) {
      return node.value.join("");
    }
  }
  if (isSql(node)) {
    return node.queryChunks.map((chunk) => chunkText(chunk)).join(" ");
  }
  return "";
}

function sqlChunkText(node: unknown): string {
  return chunkText(node).toLowerCase();
}

function notInIds(clause: unknown): Set<string> | null {
  if (!sqlChunkText(clause).includes("not in")) {
    return null;
  }
  const ids = new Set<string>();
  function walk(node: unknown): void {
    if (isParam(node) && typeof node.value === "string") {
      ids.add(node.value);
      return;
    }
    if (isSql(node)) {
      for (const chunk of node.queryChunks) {
        walk(chunk);
      }
    }
  }
  walk(clause);
  return ids;
}

function inArrayConstraint(
  clause: unknown,
): { column: string; values: Set<string> } | null {
  const text = sqlChunkText(clause);
  if (!text.includes(" in ") || text.includes("not in") || text.includes(" and ")) {
    return null;
  }
  let column: string | undefined;
  const values = new Set<string>();
  walkQueryChunks(clause, (node) => {
    if (isColumn(node)) {
      column = node.name;
      return;
    }
    if (!isParam(node)) {
      return;
    }
    if (Array.isArray(node.value)) {
      for (const value of node.value) {
        if (typeof value === "string") {
          values.add(value);
        }
      }
      return;
    }
    if (typeof node.value === "string") {
      values.add(node.value);
    }
  });
  if (column === undefined || values.size === 0) {
    return null;
  }
  return { column, values };
}

function allInArrayConstraints(
  clause: unknown,
): Array<{ column: string; values: Set<string> }> {
  const constraints: Array<{ column: string; values: Set<string> }> = [];
  function walk(node: unknown): void {
    if (isSql(node)) {
      const constraint = inArrayConstraint(node);
      if (constraint !== null) {
        constraints.push(constraint);
      }
      for (const chunk of node.queryChunks) {
        walk(chunk);
      }
      return;
    }
    if (typeof node === "object" && node !== null) {
      const numericKeys = Object.keys(node).filter((key) => /^\d+$/.test(key));
      if (numericKeys.length > 0) {
        for (const key of numericKeys) {
          walk((node as Record<string, unknown>)[key]);
        }
      }
    }
  }
  walk(clause);
  return constraints;
}

function rowMatches(row: Record<string, unknown>, clause: unknown): boolean {
  const pairs = eqPairs(clause);
  if (!pairs.every(({ column, value }) => row[sqlNameToKey(column)] === value)) {
    return false;
  }
  const excluded = notInIds(clause);
  if (excluded !== null && excluded.has(String(row.id))) {
    return false;
  }
  for (const included of allInArrayConstraints(clause)) {
    const value = row[sqlNameToKey(included.column)];
    if (typeof value !== "string" || !included.values.has(value)) {
      return false;
    }
  }
  const included = allInArrayConstraints(clause);
  return pairs.length > 0 || excluded !== null || included.length > 0;
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
  readonly statements: string[] = [];
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
    const self = this;
    return {
      from: (table: unknown) => ({
        where: (clause: unknown) => {
          const rowsForTable = () => {
            if (table === purchaseOrders) {
              return [...self.orders.values()].filter((row) => rowMatches(row, clause));
            }
            if (table === suppliers) {
              return [...self.supplierRows.values()].filter((row) => rowMatches(row, clause));
            }
            return [...self.lines.values()].filter((row) => rowMatches(row, clause));
          };
          const rows = rowsForTable();
          const result = thenableRows(rows as OrderRow[]);
          return Object.assign(result, {
            orderBy: (..._order: unknown[]) => thenableRows(rows as OrderRow[]),
            limit: (n: number) => thenableRows((rows as OrderRow[]).slice(0, n)),
          });
        },
        leftJoin: (_other: unknown, _on: unknown) => ({
          where: (clause: unknown) => {
            const rows = [...self.orders.values()].filter((row) => rowMatches(row, clause));
            const result = thenableRows(rows.map((header) => ({ header })));
            return Object.assign(result, {
              orderBy: (..._order: unknown[]) => thenableRows(rows.map((header) => ({ header }))),
              limit: (n: number) =>
                thenableRows(rows.slice(0, n).map((header) => ({ header }))),
              offset: (_offset: number) => result,
            });
          },
        }),
      }),
    };
  }

  selectDistinctOn(_columns: unknown[], _selection: unknown) {
    const self = this;
    return {
      from: (table: unknown) => ({
        where: (clause: unknown) => ({
          orderBy: (..._order: unknown[]) => {
            if (table !== purchaseOrders) {
              return thenableRows([]);
            }
            const rows = [...self.orders.values()].filter((row) => rowMatches(row, clause));
            const newestBySupplier = new Map<string, OrderRow>();
            for (const row of rows) {
              const existing = newestBySupplier.get(row.supplierId);
              if (existing === undefined || row.createdAt > existing.createdAt) {
                newestBySupplier.set(row.supplierId, row);
              }
            }
            const headers = [...newestBySupplier.values()].sort((left, right) =>
              left.supplierId.localeCompare(right.supplierId),
            );
            return thenableRows(headers.map((header) => ({ header })));
          },
        }),
      }),
    };
  }

  insert(table: unknown) {
    return {
      values: (value: OrderRow | LineRow | Array<OrderRow | LineRow>) => {
        if (table === supplierPoDocumentNumberCounters) {
          this.statements.push("counter");
          return {
            onConflictDoUpdate: async () => ({ sequence: 1 }),
            returning: async () => [{ sequence: 1 }],
          };
        }
        const write = (upsert: boolean) => {
          if (table === purchaseOrderLines && this.failNextLineInsert) {
            this.failNextLineInsert = false;
            throw new Error("forced line insert failure");
          }
          this.statements.push(upsert ? "upsert-lines" : "insert");
          const rows = Array.isArray(value) ? value : [value];
          for (const row of rows) {
            if (table === purchaseOrders) {
              this.orders.set(row.id, { ...(row as OrderRow) });
              continue;
            }
            const existing = this.lines.get(row.id);
            this.lines.set(row.id, {
              ...(existing ?? {}),
              ...(row as LineRow),
              updatedAt: upsert ? new Date() : (row as LineRow).updatedAt,
            });
          }
        };
        return {
          then: (resolve: (value: void) => void, reject: (error: unknown) => void) => {
            try {
              write(false);
              resolve();
            } catch (error) {
              reject(error);
            }
          },
          onConflictDoUpdate: async () => {
            write(true);
          },
        };
      },
    };
  }

  update(table: unknown) {
    return {
      set: (patch: Record<string, unknown>) => ({
        where: (clause: unknown) => {
          let updated: unknown[] | undefined;
          const apply = () => {
            if (updated !== undefined) {
              return updated;
            }
            this.statements.push("update");
            const target = table === purchaseOrders ? this.orders : this.lines;
            updated = [];
            for (const [id, row] of target) {
              if (rowMatches(row as unknown as Record<string, unknown>, clause)) {
                const next = { ...row, ...patch };
                target.set(id, next as never);
                updated.push(next);
              }
            }
            return updated;
          };
          return Object.assign(Promise.resolve().then(apply), {
            returning: async () => apply(),
          });
        },
      }),
    };
  }

  delete(table: unknown) {
    return {
      where: async (clause: unknown) => {
        this.statements.push("delete");
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

const SUPPLIER_B = SupplierId.parse("cccccccc-cccc-4ccc-8ccc-cccccccccc01");
const OLDER_DRAFT_ID = PurchaseOrderId.parse("dddddddd-dddd-4ddd-8ddd-dddddddddd01");
const NEWER_DRAFT_ID = PurchaseOrderId.parse("eeeeeeee-eeee-4eee-8eee-eeeeeeeeee01");
const OTHER_SUPPLIER_DRAFT_ID = PurchaseOrderId.parse("ffffffff-ffff-4fff-8fff-ffffffffffff");
const CONFIRMED_PO_ID = PurchaseOrderId.parse("11111111-1111-4111-8111-111111111111");

function seedDraftOrders(db: FakePurchasingDb): void {
  db.orders.set(OLDER_DRAFT_ID, {
    id: OLDER_DRAFT_ID,
    organizationId: ORG,
    supplierId: SUPPLIER_ID,
    status: "draft",
    documentNumber: "PO-HF-00001",
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
  });
  db.orders.set(NEWER_DRAFT_ID, {
    id: NEWER_DRAFT_ID,
    organizationId: ORG,
    supplierId: SUPPLIER_ID,
    status: "draft",
    documentNumber: "PO-HF-00002",
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
  });
  db.orders.set(OTHER_SUPPLIER_DRAFT_ID, {
    id: OTHER_SUPPLIER_DRAFT_ID,
    organizationId: ORG,
    supplierId: SUPPLIER_B,
    status: "draft",
    documentNumber: "PO-FB-00001",
    createdAt: new Date("2026-08-15T00:00:00.000Z"),
  });
  db.orders.set(CONFIRMED_PO_ID, {
    id: CONFIRMED_PO_ID,
    organizationId: ORG,
    supplierId: SUPPLIER_B,
    status: "confirmed",
    documentNumber: "PO-FB-00002",
    createdAt: new Date("2026-09-02T00:00:00.000Z"),
  });
  db.lines.set(LINE_A, {
    id: LINE_A,
    purchaseOrderId: NEWER_DRAFT_ID,
    sku: SKU.value,
    name: "Bolt",
    qty: 5,
    receivedQty: 0,
  });
  db.lines.set(LINE_B, {
    id: LINE_B,
    purchaseOrderId: OTHER_SUPPLIER_DRAFT_ID,
    sku: OTHER_SKU.value,
    name: "Washer",
    qty: 2,
    receivedQty: 0,
  });
}

describe("DrizzlePurchaseOrderRepository.listNewestDraftsBySuppliers", () => {
  it("matches drizzle inArray clauses in the fake database", async () => {
    const { and, eq, inArray } = await import("drizzle-orm");
    const supplierIn = inArray(purchaseOrders.supplierId, [SUPPLIER_ID]);
    const where = and(
      eq(purchaseOrders.organizationId, ORG),
      eq(purchaseOrders.status, "draft"),
      supplierIn,
    );
    expect(inArrayConstraint(supplierIn)).toEqual({
      column: "supplier_id",
      values: new Set([SUPPLIER_ID]),
    });
    expect(allInArrayConstraints(where)).toEqual([
      { column: "supplier_id", values: new Set([SUPPLIER_ID]) },
    ]);
    expect(
      allInArrayConstraints(
        inArray(purchaseOrderLines.purchaseOrderId, [NEWER_DRAFT_ID, OTHER_SUPPLIER_DRAFT_ID]),
      ),
    ).toEqual([
      {
        column: "purchase_order_id",
        values: new Set([NEWER_DRAFT_ID, OTHER_SUPPLIER_DRAFT_ID]),
      },
    ]);
  });

  it("returns the newest draft per supplier and ignores confirmed orders", async () => {
    const db = new FakePurchasingDb();
    seedDraftOrders(db);
    const repo = new DrizzlePurchaseOrderRepository(db as never);

    const drafts = await repo.listNewestDraftsBySuppliers({ organizationId: ORG });

    expect(drafts.map((order) => order.id).sort()).toEqual(
      [NEWER_DRAFT_ID, OTHER_SUPPLIER_DRAFT_ID].sort(),
    );
    expect(drafts.find((order) => order.id === NEWER_DRAFT_ID)?.lines[0]?.sku).toEqual(SKU);
  });

  it("filters drafts to the requested suppliers", async () => {
    const db = new FakePurchasingDb();
    seedDraftOrders(db);
    const repo = new DrizzlePurchaseOrderRepository(db as never);

    const drafts = await repo.listNewestDraftsBySuppliers({
      organizationId: ORG,
      supplierIds: [SUPPLIER_ID],
    });

    expect(drafts.map((order) => order.id)).toEqual([NEWER_DRAFT_ID]);
  });
});

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

  it("rewrites an existing order in a fixed number of statements, not one per line", async () => {
    const db = new FakePurchasingDb();
    const repo = new DrizzlePurchaseOrderRepository(db as never);
    const many = [LINE_A, LINE_B, LINE_C].map((id, index) =>
      line(id, Sku.parse(`SKU-${index + 1}`), `Part ${index + 1}`, index + 1),
    );
    await repo.save(draft(many));
    db.statements.length = 0;

    await repo.save({
      ...draft(many),
      status: "confirmed",
      lines: many.map((row) => ({ ...row, qty: row.qty + 1 })),
    });

    expect(db.statements.filter((name) => name !== "counter")).toEqual([
      "update",
      "delete",
      "upsert-lines",
    ]);
    const loaded = await repo.findById(ORG, PO_ID);
    expect(loaded?.status).toBe("confirmed");
    expect(loaded?.lines.map((row) => row.qty)).toEqual([2, 3, 4]);
  });
});
