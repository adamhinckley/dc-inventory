import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { opsSubscriptionSchema, stubOpsSubscription } from "../schemas.js";

function typed(app: FastifyInstance) {
  return app.withTypeProvider<ZodTypeProvider>();
}

/** Ops / licensing mount (`/ops`). */
export async function opsRoutes(app: FastifyInstance): Promise<void> {
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
