import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { boolean, integer, pgTable, timestamp } from "drizzle-orm/pg-core";
import {
  isShopSellableSql,
  matchesWholesaleAvailabilityFilterSql,
  staffCatalogAvailableToSellOrderBySql,
  staffCatalogDemandProjectionSql,
  type DemandProjectionSnapshotColumns,
  type WholesaleAvailabilityFilterSqlOptions,
} from "../../src/persistence/demand-projection-sql.js";

const demandProjectionFixture = pgTable("demand_projection_fixture", {
  id: integer("id").primaryKey(),
  onHand: integer("on_hand").notNull(),
  onOrder: integer("on_order").notNull(),
  committed: integer("committed").notNull(),
  stickyLocked: boolean("sticky_locked").notNull(),
  windowOpensAt: timestamp("window_opens_at", { withTimezone: true, mode: "date" }),
  windowClosesAt: timestamp("window_closes_at", { withTimezone: true, mode: "date" }),
});

export type DemandProjectionFixtureRow = Readonly<{
  onHand: number;
  onOrder: number;
  allocated: number;
  committed: number;
  stickyLocked: boolean;
  windowOpensAt: Date | null;
  windowClosesAt: Date | null;
}>;

export type DemandProjectionSqlEvaluation = Readonly<{
  isLocked: boolean;
  availableToSell: number | null;
}>;

const projectionColumns = {
  onHand: demandProjectionFixture.onHand,
  onOrder: demandProjectionFixture.onOrder,
  committed: demandProjectionFixture.committed,
  stickyLocked: demandProjectionFixture.stickyLocked,
  windowOpensAt: demandProjectionFixture.windowOpensAt,
  windowClosesAt: demandProjectionFixture.windowClosesAt,
} as unknown as DemandProjectionSnapshotColumns;

type DemandProjectionSqlDb = {
  select: (fields: Record<string, unknown>) => {
    from: (table: unknown) => {
      orderBy: (...order: unknown[]) => {
        toSQL: () => { sql: string; params: unknown[] };
      };
      toSQL: () => { sql: string; params: unknown[] };
    };
  };
};

function staffCatalogProjection(nowIso: string) {
  return staffCatalogDemandProjectionSql(projectionColumns, nowIso);
}

function buildProjectionQuery(db: DemandProjectionSqlDb, nowIso: string) {
  const projection = staffCatalogProjection(nowIso);
  return db
    .select({
      isLocked: projection.isLockedForSell.as("is_locked"),
      availableToSell: projection.availableToSell.as("available_to_sell"),
    })
    .from(demandProjectionFixture);
}

function buildAvailableToSellOrderByQuery(
  db: DemandProjectionSqlDb,
  nowIso: string,
  sortOrder: "asc" | "desc",
) {
  const projection = staffCatalogProjection(nowIso);
  return db
    .select({
      id: demandProjectionFixture.id,
      availableToSell: projection.availableToSell.as("available_to_sell"),
    })
    .from(demandProjectionFixture)
    .orderBy(staffCatalogAvailableToSellOrderBySql(projection.availableToSell, sortOrder));
}

function buildSellStateOrderByQuery(
  db: DemandProjectionSqlDb,
  nowIso: string,
  sortOrder: "asc" | "desc",
) {
  const projection = staffCatalogProjection(nowIso);
  const orderBy =
    sortOrder === "desc"
      ? sql`${projection.isLockedForSell} DESC`
      : sql`${projection.isLockedForSell} ASC`;
  return db
    .select({
      id: demandProjectionFixture.id,
      isLocked: projection.isLockedForSell.as("is_locked"),
    })
    .from(demandProjectionFixture)
    .orderBy(orderBy);
}

function buildIsShopSellableQuery(db: DemandProjectionSqlDb, nowIso: string, warehouseAvailable: number) {
  const available = sql<number>`${warehouseAvailable}`;
  return db
    .select({
      isShopSellable: isShopSellableSql(available, projectionColumns, nowIso).as("is_shop_sellable"),
    })
    .from(demandProjectionFixture);
}

function buildMatchesWholesaleAvailabilityFilterQuery(
  db: DemandProjectionSqlDb,
  nowIso: string,
  filters: WholesaleAvailabilityFilterSqlOptions,
) {
  return db
    .select({
      matches: matchesWholesaleAvailabilityFilterSql(
        projectionColumns,
        nowIso,
        filters,
      ).as("matches"),
    })
    .from(demandProjectionFixture);
}

async function seedFixtureRows(
  client: PGlite,
  rows: readonly DemandProjectionFixtureRow[],
): Promise<void> {
  await client.exec("DELETE FROM demand_projection_fixture");
  for (const [index, row] of rows.entries()) {
    await client.query(
      `
        INSERT INTO demand_projection_fixture
          (id, on_hand, on_order, committed, sticky_locked, window_opens_at, window_closes_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        index + 1,
        row.onHand,
        row.onOrder,
        row.committed,
        row.stickyLocked,
        row.windowOpensAt,
        row.windowClosesAt,
      ],
    );
  }
}

export async function createDemandProjectionSqlEvaluator() {
  const client = new PGlite();
  await client.exec(`
    CREATE TABLE demand_projection_fixture (
      id integer PRIMARY KEY,
      on_hand integer NOT NULL,
      on_order integer NOT NULL,
      committed integer NOT NULL,
      sticky_locked boolean NOT NULL,
      window_opens_at timestamptz,
      window_closes_at timestamptz
    );
  `);
  const db = drizzle.mock({
    schema: { demandProjectionFixture },
  }) as unknown as DemandProjectionSqlDb;

  return {
    async evaluate(
      row: DemandProjectionFixtureRow,
      now: Date,
    ): Promise<DemandProjectionSqlEvaluation> {
      await seedFixtureRows(client, [row]);
      const nowIso = now.toISOString();
      const { sql: selectSql, params } = buildProjectionQuery(db, nowIso).toSQL();
      const result = await client.query<{
        is_locked: boolean;
        available_to_sell: number | null;
      }>(selectSql, params);
      const evaluated = result.rows[0];
      if (evaluated === undefined) {
        throw new Error("demand projection SQL evaluation returned no row");
      }
      return {
        isLocked: evaluated.is_locked,
        availableToSell: evaluated.available_to_sell,
      };
    },
    async orderByAvailableToSell(
      rows: readonly DemandProjectionFixtureRow[],
      now: Date,
      sortOrder: "asc" | "desc",
    ): Promise<readonly (number | null)[]> {
      await seedFixtureRows(client, rows);
      const nowIso = now.toISOString();
      const { sql: selectSql, params } = buildAvailableToSellOrderByQuery(
        db,
        nowIso,
        sortOrder,
      ).toSQL();
      const result = await client.query<{
        available_to_sell: number | null;
      }>(selectSql, params);
      return result.rows.map((row) => row.available_to_sell);
    },
    async orderBySellState(
      rows: readonly DemandProjectionFixtureRow[],
      now: Date,
      sortOrder: "asc" | "desc",
    ): Promise<readonly boolean[]> {
      await seedFixtureRows(client, rows);
      const nowIso = now.toISOString();
      const { sql: selectSql, params } = buildSellStateOrderByQuery(db, nowIso, sortOrder).toSQL();
      const result = await client.query<{
        is_locked: boolean;
      }>(selectSql, params);
      return result.rows.map((row) => row.is_locked);
    },
    async evaluateIsShopSellable(
      row: DemandProjectionFixtureRow,
      now: Date,
    ): Promise<boolean> {
      await seedFixtureRows(client, [row]);
      const nowIso = now.toISOString();
      const warehouseAvailable = row.onHand - row.allocated;
      const { sql: selectSql, params } = buildIsShopSellableQuery(
        db,
        nowIso,
        warehouseAvailable,
      ).toSQL();
      const result = await client.query<{
        is_shop_sellable: boolean;
      }>(selectSql, params);
      const evaluated = result.rows[0];
      if (evaluated === undefined) {
        throw new Error("isShopSellable SQL evaluation returned no row");
      }
      return evaluated.is_shop_sellable;
    },
    async evaluateMatchesWholesaleAvailabilityFilter(
      row: DemandProjectionFixtureRow,
      now: Date,
      filters: WholesaleAvailabilityFilterSqlOptions,
    ): Promise<boolean> {
      await seedFixtureRows(client, [row]);
      const nowIso = now.toISOString();
      const { sql: selectSql, params } = buildMatchesWholesaleAvailabilityFilterQuery(
        db,
        nowIso,
        filters,
      ).toSQL();
      const result = await client.query<{
        matches: boolean;
      }>(selectSql, params);
      const evaluated = result.rows[0];
      if (evaluated === undefined) {
        throw new Error("matchesWholesaleAvailabilityFilter SQL evaluation returned no row");
      }
      return evaluated.matches;
    },
    async close(): Promise<void> {
      await client.close();
    },
  };
}
