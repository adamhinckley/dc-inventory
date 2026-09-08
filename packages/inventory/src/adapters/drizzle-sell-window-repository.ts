import { OrganizationId, Sku } from "@dc-inventory/shared-kernel";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { SellWindowId } from "../domain/ids.js";
import type { SellWindow } from "../domain/sell-window.js";
import type {
  CreateSellWindowRecord,
  ISellWindowRepository,
  ListSellWindowsQuery,
  SellWindowDetail,
  SellWindowListPage,
} from "../domain/ports/sell-window-repository.js";
import { sellWindowSkus, sellWindows } from "../persistence/schema.js";
import { toSellWindow } from "../persistence/sell-window-mapper.js";

export type SellWindowDrizzle = PostgresJsDatabase<{
  sellWindows: typeof sellWindows;
  sellWindowSkus: typeof sellWindowSkus;
}>;

function sortColumn(sortBy: ListSellWindowsQuery["sortBy"]) {
  switch (sortBy) {
    case "name":
      return sellWindows.name;
    case "status":
      return sellWindows.status;
    case "windowOpensAt":
      return sellWindows.windowOpensAt;
    case "windowClosesAt":
      return sellWindows.windowClosesAt;
    default:
      return sellWindows.appliedAt;
  }
}

export class DrizzleSellWindowRepository implements ISellWindowRepository {
  constructor(private readonly db: SellWindowDrizzle) {}

  async create(record: CreateSellWindowRecord): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.insert(sellWindows).values({
        id: record.window.id,
        organizationId: record.window.organizationId,
        name: record.window.name,
        filterSnapshot: record.window.filterSnapshot,
        windowOpensAt: record.window.windowOpensAt,
        windowClosesAt: record.window.windowClosesAt,
        status: record.window.status,
        manuallyClosedAt: record.window.manuallyClosedAt,
        appliedBy: record.window.appliedBy,
        appliedAt: record.window.appliedAt,
        skuCount: record.window.skuCount,
        createdAt: record.window.createdAt,
        updatedAt: record.window.updatedAt,
      });
      if (record.skus.length > 0) {
        await tx.insert(sellWindowSkus).values(
          record.skus.map((sku) => ({
            organizationId: record.window.organizationId,
            sellWindowId: record.window.id,
            sku: sku.value,
          })),
        );
      }
    });
  }

  async list(query: ListSellWindowsQuery): Promise<SellWindowListPage> {
    const where = eq(sellWindows.organizationId, query.organizationId);
    const order = query.sortOrder === "asc" ? asc : desc;
    const rows = await this.db
      .select()
      .from(sellWindows)
      .where(where)
      .orderBy(order(sortColumn(query.sortBy)))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);
    const totalRow = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(sellWindows)
      .where(where);
    return {
      items: rows.map(toSellWindow),
      total: totalRow[0]?.count ?? 0,
    };
  }

  async findById(
    organizationId: OrganizationId,
    id: SellWindowId,
  ): Promise<SellWindowDetail | null> {
    const rows = await this.db
      .select()
      .from(sellWindows)
      .where(and(eq(sellWindows.organizationId, organizationId), eq(sellWindows.id, id)))
      .limit(1);
    const row = rows[0];
    if (row === undefined) {
      return null;
    }
    const skuRows = await this.db
      .select({ sku: sellWindowSkus.sku })
      .from(sellWindowSkus)
      .where(
        and(eq(sellWindowSkus.organizationId, organizationId), eq(sellWindowSkus.sellWindowId, id)),
      )
      .orderBy(asc(sellWindowSkus.sku));
    return {
      ...toSellWindow(row),
      skus: skuRows.map((skuRow) => Sku.parse(skuRow.sku)),
    };
  }

  async close(
    organizationId: OrganizationId,
    id: SellWindowId,
    manuallyClosedAt: Date,
  ): Promise<SellWindow | null> {
    const rows = await this.db
      .update(sellWindows)
      .set({
        manuallyClosedAt,
        status: "closed",
        updatedAt: manuallyClosedAt,
      })
      .where(and(eq(sellWindows.organizationId, organizationId), eq(sellWindows.id, id)))
      .returning();
    const row = rows[0];
    if (row === undefined) {
      return null;
    }
    return toSellWindow(row);
  }
}
