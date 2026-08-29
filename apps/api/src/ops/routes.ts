import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { registerOpsAuthRoutes } from "../adapters/http/ops-auth.js";
import { opsSubscriptionSchema, stubOpsSubscription } from "../schemas.js";

function typed(app: FastifyInstance) {
  return app.withTypeProvider<ZodTypeProvider>();
}

/** Ops / licensing mount (`/ops`). */
export async function opsRoutes(app: FastifyInstance): Promise<void> {
  registerOpsAuthRoutes(app);

  typed(app).route({
    method: "GET",
    url: "/subscription",
    schema: {
      operationId: "getOpsSubscription",
      tags: ["ops"],
      summary: "Stub software subscription",
      response: { 200: opsSubscriptionSchema },
    },
    handler: async () => stubOpsSubscription,
  });
}
