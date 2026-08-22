import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";

export const healthResponseSchema = z.object({
  ok: z.literal(true),
});

export const readyResponseSchema = z.object({
  ready: z.literal(true),
});

/**
 * Liveness + readiness. `/health` must not touch Postgres or other I/O.
 * `/ready` is a stub until ADA-34 wires a real `SELECT 1`.
 */
export function registerHealthRoutes(app: FastifyInstance): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.route({
    method: "GET",
    url: "/health",
    schema: {
      response: { 200: healthResponseSchema },
    },
    handler: async () => ({ ok: true as const }),
  });

  typed.route({
    method: "GET",
    url: "/ready",
    schema: {
      response: { 200: readyResponseSchema },
    },
    handler: async () => ({ ready: true as const }),
  });
}
