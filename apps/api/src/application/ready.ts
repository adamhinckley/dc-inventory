import type { IDatabase } from "../domain/database.js";

export type ReadyResult =
  | { ready: true }
  | { ready: false; cause: unknown };

/**
 * Readiness check: one ping through the database port.
 * HTTP maps `{ ready: true }` to 200 and `{ ready: false }` to 503.
 */
export class ReadyCheckUseCase {
  constructor(private readonly database: IDatabase) {}

  async execute(): Promise<ReadyResult> {
    try {
      await this.database.ping();
      return { ready: true };
    } catch (error) {
      return { ready: false, cause: error };
    }
  }
}
