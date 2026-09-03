import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/postgres-js";
import { boolean, integer, pgTable, timestamp } from "drizzle-orm/pg-core";
import {
  availableToSellProjectionSql,
  isLockedForSellSql,
  type DemandProjectionSnapshotColumns,
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
      toSQL: () => { sql: string; params: unknown[] };
    };
  };
};

function buildProjectionQuery(db: DemandProjectionSqlDb, nowIso: string) {
  return db
    .select({
      isLocked: isLockedForSellSql(projectionColumns, nowIso).as("is_locked"),
      availableToSell: availableToSellProjectionSql(projectionColumns, nowIso).as(
        "available_to_sell",
      ),
    })
    .from(demandProjectionFixture);
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
      await client.query(
        `
          INSERT INTO demand_projection_fixture
            (id, on_hand, on_order, committed, sticky_locked, window_opens_at, window_closes_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (id) DO UPDATE SET
            on_hand = EXCLUDED.on_hand,
            on_order = EXCLUDED.on_order,
            committed = EXCLUDED.committed,
            sticky_locked = EXCLUDED.sticky_locked,
            window_opens_at = EXCLUDED.window_opens_at,
            window_closes_at = EXCLUDED.window_closes_at
        `,
        [
          1,
          row.onHand,
          row.onOrder,
          row.committed,
          row.stickyLocked,
          row.windowOpensAt,
          row.windowClosesAt,
        ],
      );
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
    async close(): Promise<void> {
      await client.close();
    },
  };
}
