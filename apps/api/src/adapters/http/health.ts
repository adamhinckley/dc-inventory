import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";

export const healthResponseSchema = z.object({
  ok: z.literal(true),
});

export const readyResponseSchema = z.object({
  ready: z.literal(true),
});

export const notReadyResponseSchema = z.object({
  ready: z.literal(false),
  error: z.string(),
});

function typed(app: FastifyInstance) {
  return app.withTypeProvider<ZodTypeProvider>();
}

/**
 * Liveness + readiness. `/health` must not touch Postgres or other I/O.
 * `/ready` runs `SELECT 1` through `ReadyCheckUseCase` (IDatabase port).
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
        summary: "Readiness: Postgres SELECT 1",
        response: {
          200: readyResponseSchema,
          503: notReadyResponseSchema,
        },
      },
    },
    async (_request, reply) => {
      const result = await app.readyCheck.execute();
      if (!result.ready) {
        return reply.code(503).send(result);
      }
      return result;
    },
  );
}
