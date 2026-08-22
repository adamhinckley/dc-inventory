import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";

export const pingResponseSchema = z.object({
  ok: z.literal(true),
  at: z.iso.datetime(),
});

/** Driving adapter: parse (none), call Ping, map `at` to ISO-8601. */
export function registerPingRoute(app: FastifyInstance): void {
  app.withTypeProvider<ZodTypeProvider>().route({
    method: "GET",
    url: "/ping",
    schema: {
      response: { 200: pingResponseSchema },
    },
    handler: async (request) => {
      const result = request.server.ping.execute();
      return { ok: result.ok, at: result.at.toISOString() };
    },
  });
}
