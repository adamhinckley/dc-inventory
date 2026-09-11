import {
  CustomerId,
  Money,
  OrderId,
  OrganizationId,
  Sku,
} from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { DrizzleSalesOrderRepository } from "../src/adapters/drizzle-sales-orders.js";
import { SalesOrderLineId } from "../src/domain/ids.js";
import type { SalesOrder, SalesOrderLine } from "../src/domain/sales-order.js";
import { documentNumberCounters, orderLines, orders } from "../src/persistence/schema.js";

const ORG = OrganizationId.DEFAULT;
const ORDER_ID = OrderId.parse("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01");
const CUSTOMER_ID = CustomerId.parse("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01");
const SKU = Sku.parse("SO-SAVE-SKU");
const LINE_A = SalesOrderLineId.parse("cccccccc-cccc-4ccc-8ccc-cccccccccc01");

type OrderRow = {
  id: string;
  organizationId: string;
  customerId: string;
  status: SalesOrder["status"];
  documentNumber: string;
  label: string | null;
  createdAt: Date;
  confirmedAt?: Date | null;
  shippedAt?: Date | null;
  cancelledAt?: Date | null;
  updatedAt?: Date;
  shipLine1?: string | null;
  shipLine2?: string | null;
  shipCity?: string | null;
  shipRegion?: string | null;
  shipPostal?: string | null;
  shipCountry?: string | null;
  placedByStaffUserId?: string | null;
  creditLimitOverriddenByStaffUserId?: string | null;
};

type LineRow = {
  id: string;
  orderId: string;
  sku: string;
  name: string;
  qty: number;
  unitPriceCents: number;
  currency: string;
  taxCategoryCode: string | null;
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
  const pairs = eqPairs(clause);
  return pairs.length > 0 && pairs.every(({ column, value }) => row[sqlNameToKey(column)] === value);
}

function thenableRows<T>(rows: T[]) {
  return Object.assign(Promise.resolve(rows), {
    limit: (n: number) => Promise.resolve(rows.slice(0, n)),
  });
}

class FakeSalesDb {
  readonly orders = new Map<string, OrderRow>();
  readonly lines = new Map<string, LineRow>();
  orderLineSelectCount = 0;

  async transaction<T>(work: (tx: FakeSalesDb) => Promise<T>): Promise<T> {
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
          if (table === orderLines) {
            self.orderLineSelectCount += 1;
          }
          const rows =
            table === orders
              ? [...self.orders.values()].filter((row) => rowMatches(row, clause))
              : [...self.lines.values()].filter((row) => rowMatches(row, clause));
          const result = thenableRows(rows);
          return Object.assign(result, {
            orderBy: (..._order: unknown[]) => thenableRows(rows),
            limit: (n: number) => thenableRows(rows.slice(0, n)),
          });
        },
      }),
    };
  }

  insert(table: unknown) {
    const self = this;
    return {
      values: (value: OrderRow | LineRow | Array<OrderRow | LineRow>) => {
        const write = (upsert: boolean) => {
          const rows = Array.isArray(value) ? value : [value];
          for (const row of rows) {
            if (table === orders) {
              self.orders.set(row.id, { ...(row as OrderRow) });
              continue;
            }
            if (table === orderLines) {
              const existing = self.lines.get(row.id);
              self.lines.set(row.id, {
                ...(existing ?? {}),
                ...(row as LineRow),
                updatedAt: upsert ? new Date() : (row as LineRow).updatedAt,
              });
            }
          }
        };
        if (table === documentNumberCounters) {
          return {
            onConflictDoUpdate: async () => ({ sequence: 1 }),
            returning: async () => [{ sequence: 1 }],
          };
        }
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
    const self = this;
    return {
      set: (patch: Record<string, unknown>) => ({
        where: async (clause: unknown) => {
          const target = table === orders ? self.orders : self.lines;
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
    const self = this;
    return {
      where: async (clause: unknown) => {
        const target = table === orders ? self.orders : self.lines;
        for (const [id, row] of target) {
          if (rowMatches(row as unknown as Record<string, unknown>, clause)) {
            target.delete(id);
          }
        }
      },
    };
  }
}

function line(id: SalesOrderLineId, sku: Sku, name: string, qty: number): SalesOrderLine {
  return {
    id,
    sku,
    name,
    qty,
    unitPrice: Money.fromMinorUnits(1000, "USD"),
  };
}

function draft(lines: SalesOrderLine[]): SalesOrder {
  return {
    id: ORDER_ID,
    organizationId: ORG,
    customerId: CUSTOMER_ID,
    documentNumber: "SO-00099",
    status: "draft",
    createdAt: new Date("2026-08-28T00:00:00.000Z"),
    lines,
  };
}

function seedOrder(db: FakeSalesDb, order: SalesOrder): void {
  db.orders.set(order.id, {
    id: order.id,
    organizationId: order.organizationId,
    customerId: order.customerId,
    status: order.status,
    documentNumber: order.documentNumber,
    label: order.label ?? null,
    createdAt: order.createdAt,
    shipLine1: order.shipLine1 ?? null,
    shipLine2: order.shipLine2 ?? null,
    shipCity: order.shipCity ?? null,
    shipRegion: order.shipRegion ?? null,
    shipPostal: order.shipPostal ?? null,
    shipCountry: order.shipCountry ?? null,
    placedByStaffUserId: order.placedByStaffUserId ?? null,
    creditLimitOverriddenByStaffUserId: order.creditLimitOverriddenByStaffUserId ?? null,
  });
  for (const row of order.lines) {
    db.lines.set(row.id, {
      id: row.id,
      orderId: order.id,
      sku: row.sku.value,
      name: row.name,
      qty: row.qty,
      unitPriceCents: row.unitPrice.amountMinor,
      currency: row.unitPrice.currency,
      taxCategoryCode: row.taxCategoryCode ?? null,
    });
  }
}

describe("DrizzleSalesOrderRepository.save", () => {
  it("does not select order_lines when the caller passes the loaded aggregate", async () => {
    const db = new FakeSalesDb();
    const initial = draft([line(LINE_A, SKU, "Widget", 5)]);
    seedOrder(db, initial);
    const repo = new DrizzleSalesOrderRepository(db as never);

    db.orderLineSelectCount = 0;
    await repo.save(
      {
        ...initial,
        lines: [line(LINE_A, SKU, "Widget updated", 8)],
      },
      initial,
    );

    expect(db.orderLineSelectCount).toBe(0);
    const loaded = await repo.findById(ORG, ORDER_ID);
    expect(loaded?.lines[0]?.qty).toBe(8);
  });

  it("selects order_lines when existing state is not provided", async () => {
    const db = new FakeSalesDb();
    const initial = draft([line(LINE_A, SKU, "Widget", 5)]);
    seedOrder(db, initial);
    const repo = new DrizzleSalesOrderRepository(db as never);

    db.orderLineSelectCount = 0;
    await repo.save({
      ...initial,
      lines: [line(LINE_A, SKU, "Widget updated", 8)],
    });

    expect(db.orderLineSelectCount).toBeGreaterThan(0);
  });
});
