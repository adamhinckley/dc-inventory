import type { IDatabase } from "../domain/database.js";

export type ReadyResult =
  | { ready: true }
  | { ready: false; error: string };

function sanitizeReadyError(message: string): string {
  return message.replace(/\b[a-z][a-z0-9+.-]*:\/\/\S+/gi, "[redacted-url]");
}

function toPublicError(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return sanitizeReadyError(error.message);
  }
  return "database is not ready";
}

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
      return { ready: false, error: toPublicError(error) };
    }
  }
}
