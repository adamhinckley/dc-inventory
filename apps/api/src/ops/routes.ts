import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { OrganizationId } from "@dc-inventory/shared-kernel";
import { registerOpsAudienceGuard } from "../adapters/http/audience-guard.js";
import {
  registerOpsLoginRoute,
  registerProtectedOpsAuthRoutes,
} from "../adapters/http/ops-auth.js";
import { opsSubscriptionSchema, unauthorizedResponseSchema } from "../schemas.js";

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
      summary: "Get software subscription",
      response: {
        200: opsSubscriptionSchema,
        401: unauthorizedResponseSchema,
      },
    },
    handler: async (request) => {
      const subscription = await request.server.licensing.getLatestSubscription.execute({
        organizationId: OrganizationId.DEFAULT,
      });
      return subscription === null
        ? { status: "inactive" as const, plan: null }
        : { status: subscription.status, plan: subscription.plan };
    },
  });
}
