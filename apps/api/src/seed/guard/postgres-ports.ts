import type { Sql, TransactionSql } from "postgres";
import { DEMO_OWNED_SCHEMAS } from "./constants.js";
import type { DemoOwnedSchema } from "./constants.js";
import type {
  DemoBookOccupancy,
  IDemoBookOccupancyPort,
  IDemoBookResetPort,
} from "./ports.js";

type PostgresQueryable = Sql | TransactionSql;

function quoteIdent(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

async function listBaseTables(
  sql: PostgresQueryable,
  schemaName: DemoOwnedSchema,
): Promise<string[]> {
  const rows = await sql<{ table_name: string }[]>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = ${schemaName}
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `;
  return rows.map((row) => row.table_name);
}

export class PostgresDemoBookOccupancy implements IDemoBookOccupancyPort {
  constructor(private readonly sql: Sql) {}

  async checkOccupancy(): Promise<DemoBookOccupancy> {
    for (const schemaName of DEMO_OWNED_SCHEMAS) {
      const tables = await listBaseTables(this.sql, schemaName);
      for (const tableName of tables) {
        const qualified = `${quoteIdent(schemaName)}.${quoteIdent(tableName)}`;
        const rows = await this.sql.unsafe<{ exists: boolean }[]>(
          `SELECT EXISTS (SELECT 1 FROM ${qualified} LIMIT 1) AS "exists"`,
        );
        if (rows[0]?.exists) {
          return {
            occupied: true,
            location: `${schemaName}.${tableName}`,
          };
        }
      }
    }
    return { occupied: false };
  }
}

export class PostgresDemoBookReset implements IDemoBookResetPort {
  constructor(private readonly sql: Sql) {}

  async resetDemoOwnedSchemas(): Promise<void> {
    await this.sql.begin(async (tx) => {
      for (const schemaName of DEMO_OWNED_SCHEMAS) {
        const tables = await listBaseTables(tx, schemaName);
        if (tables.length === 0) {
          continue;
        }
        const qualified = tables
          .map((tableName) => `${quoteIdent(schemaName)}.${quoteIdent(tableName)}`)
          .join(", ");
        await tx.unsafe(
          `TRUNCATE TABLE ${qualified} RESTART IDENTITY CASCADE`,
        );
      }
    });
  }
}
