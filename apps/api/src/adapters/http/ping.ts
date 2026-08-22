import type { FastifyInstance } from "fastify";

/** Driving adapter: parse (none), call Ping, map `at` to ISO-8601. */
export function registerPingRoute(app: FastifyInstance): void {
  app.get("/ping", async (request) => {
    const result = request.server.ping.execute();
    return { ok: result.ok, at: result.at.toISOString() };
  });
}
