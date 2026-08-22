import type { FastifyInstance } from "fastify";

/**
 * Liveness + readiness. `/health` must not touch Postgres or other I/O.
 * `/ready` is a stub until ADA-34 wires a real `SELECT 1`.
 */
export function registerHealthRoutes(app: FastifyInstance): void {
  app.get("/health", async () => ({ ok: true }));
  app.get("/ready", async () => ({ ready: true }));
}
