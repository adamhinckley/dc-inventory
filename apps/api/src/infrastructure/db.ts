import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { IDatabase } from "../domain/database.js";
import { readDatabaseUrl } from "./database-url.js";
import { schema } from "./schema.js";

export type SqlClient = ReturnType<typeof postgres>;
export type AppDrizzle = PostgresJsDatabase<typeof schema>;

export type DatabaseConnection = {
  sql: SqlClient;
  db: AppDrizzle;
};

/**
 * Composition-root helper: postgres.js client + Drizzle.
 * Catalog through operator-bridge tables are registered on the Kit home.
 */
export function createDatabaseConnection(
  url: string = readDatabaseUrl(),
): DatabaseConnection {
  const sql = postgres(url, { max: 10 });
  const db = drizzle(sql, { schema });
  return { sql, db };
}

/** Production IDatabase: `SELECT 1` via postgres.js (same client Drizzle uses). */
export class PostgresDatabase implements IDatabase {
  constructor(private readonly sql: SqlClient) {}

  async ping(): Promise<void> {
    await this.sql`SELECT 1`;
  }

  async close(): Promise<void> {
    await this.sql.end({ timeout: 5 });
  }
}

export function createPostgresDatabase(
  url: string = readDatabaseUrl(),
): PostgresDatabase {
  const { sql } = createDatabaseConnection(url);
  return new PostgresDatabase(sql);
}
