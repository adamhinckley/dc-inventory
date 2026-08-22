import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";

/** ISO-8601 instant on the wire; Zod 4 uses `z.iso.datetime()` (was `z.string().datetime()`). */
export const pingResponseSchema = z.object({
  ok: z.literal(true),
  at: z.iso.datetime(),
});

function typed(app: FastifyInstance) {
  return app.withTypeProvider<ZodTypeProvider>();
}

/** Driving adapter: parse (none), call Ping, map `at` to ISO-8601. */
export function registerPingRoute(app: FastifyInstance): void {
  typed(app).get(
    "/ping",
    {
      schema: {
        operationId: "getPing",
        tags: ["ops-signals"],
        summary: "Golden-path Ping (clock through HTTP)",
        response: { 200: pingResponseSchema },
      },
    },
    async (request) => {
      const result = request.server.ping.execute();
      return { ok: true as const, at: result.at.toISOString() };
    },
  );
}
