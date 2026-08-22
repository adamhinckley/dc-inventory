import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";

export const healthResponseSchema = z.object({
  ok: z.literal(true),
});

export const readyResponseSchema = z.object({
  ready: z.literal(true),
});

function typed(app: FastifyInstance) {
  return app.withTypeProvider<ZodTypeProvider>();
}

/**
 * Liveness + readiness. `/health` must not touch Postgres or other I/O.
 * `/ready` is a stub until ADA-34 wires a real `SELECT 1`.
 */
export function registerHealthRoutes(app: FastifyInstance): void {
  const routes = typed(app);

  routes.get(
    "/health",
    {
      schema: {
        operationId: "getHealth",
        tags: ["ops-signals"],
        summary: "Liveness probe (no database I/O)",
        response: { 200: healthResponseSchema },
      },
    },
    async () => ({ ok: true as const }),
  );

  routes.get(
    "/ready",
    {
      schema: {
        operationId: "getReady",
        tags: ["ops-signals"],
        summary: "Readiness stub until ADA-34",
        response: { 200: readyResponseSchema },
      },
    },
    async () => ({ ready: true as const }),
  );
}
