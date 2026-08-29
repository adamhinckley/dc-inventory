import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { registerOpsAudienceGuard } from "../adapters/http/audience-guard.js";
import {
  registerOpsLoginRoute,
  registerProtectedOpsAuthRoutes,
} from "../adapters/http/ops-auth.js";
import {
  opsSubscriptionSchema,
  stubOpsSubscription,
  unauthorizedResponseSchema,
} from "../schemas.js";

function typed(app: FastifyInstance) {
  return app.withTypeProvider<ZodTypeProvider>();
}

/** Ops / licensing mount (`/ops`). */
export async function opsRoutes(app: FastifyInstance): Promise<void> {
  registerOpsLoginRoute(app);
  registerOpsAudienceGuard(app);
  registerProtectedOpsAuthRoutes(app);

  typed(app).route({
    method: "GET",
    url: "/subscription",
    schema: {
      operationId: "getOpsSubscription",
      tags: ["ops"],
      summary: "Stub software subscription",
      response: {
        200: opsSubscriptionSchema,
        401: unauthorizedResponseSchema,
      },
    },
    handler: async () => stubOpsSubscription,
  });
}
