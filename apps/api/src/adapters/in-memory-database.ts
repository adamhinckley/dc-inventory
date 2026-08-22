import type { IDatabase } from "../domain/database.js";

export type InMemoryDatabaseOptions = {
  failWith?: Error;
};

/** In-memory DB port for unit tests — no Postgres, no network. */
export class InMemoryDatabase implements IDatabase {
  constructor(private readonly options: InMemoryDatabaseOptions = {}) {}

  async ping(): Promise<void> {
    if (this.options.failWith) {
      throw this.options.failWith;
    }
  }

  async close(): Promise<void> {}
}
