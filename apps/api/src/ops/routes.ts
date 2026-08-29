import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { OrganizationId } from "@dc-inventory/shared-kernel";
import { registerOpsAuthRoutes } from "../adapters/http/ops-auth.js";
import { opsSubscriptionSchema } from "../schemas.js";

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
      summary: "Get software subscription",
      response: { 200: opsSubscriptionSchema },
    },
    handler: async (request) => {
      const result = await request.server.licensing.listSubscriptions.execute({
        organizationId: OrganizationId.DEFAULT,
      });
      const subscription = result.items[0];
      return subscription === undefined
        ? { status: "inactive" as const, plan: null }
        : { status: subscription.status, plan: subscription.plan };
    },
  });
}
