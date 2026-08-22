/** Driven port: readiness and later repositories talk to this, not to Drizzle. */
export interface IDatabase {
  ping(): Promise<void>;
  close(): Promise<void>;
}
