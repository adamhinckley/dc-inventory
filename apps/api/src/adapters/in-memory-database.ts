import type { IDatabase } from "../domain/database.js";

export type InMemoryDatabaseOptions = {
  failWith?: Error;
};

/** In-memory DB port for unit tests — no Postgres, no network. */
export class InMemoryDatabase implements IDatabase {
  pingCalls = 0;
  closeCalls = 0;

  constructor(private readonly options: InMemoryDatabaseOptions = {}) {}

  async ping(): Promise<void> {
    this.pingCalls += 1;
    if (this.options.failWith) {
      throw this.options.failWith;
    }
  }

  async close(): Promise<void> {
    this.closeCalls += 1;
  }
}
