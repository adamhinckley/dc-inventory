import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { OrganizationId } from "@dc-inventory/shared-kernel";
import { registerOpsAudienceGuard } from "../adapters/http/audience-guard.js";
import {
  registerOpsLoginRoute,
  registerProtectedOpsAuthRoutes,
} from "../adapters/http/ops-auth.js";
import {
  licensingListQuerySchema,
  licensingPaymentListResponseSchema,
  opsSubscriptionSchema,
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
      summary: "Get software subscription",
      response: {
        200: opsSubscriptionSchema,
        401: unauthorizedResponseSchema,
      },
    },
    handler: async (request) => {
      const actor = request.opsAuth;
      if (actor === undefined) {
        throw new Error("ops audience guard did not set opsAuth");
      }
      const subscription = await request.server.licensing.getLatestSubscription.execute({
        organizationId: OrganizationId.parse(actor.tenantId),
      });
      return subscription === null
        ? { status: "inactive" as const, plan: null }
        : { status: subscription.status, plan: subscription.plan };
    },
  });

  typed(app).route({
    method: "GET",
    url: "/payments",
    schema: {
      operationId: "listOpsPayments",
      tags: ["ops"],
      summary: "List software subscription payments for the ops session tenant",
      querystring: licensingListQuerySchema,
      response: {
        200: licensingPaymentListResponseSchema,
        401: unauthorizedResponseSchema,
      },
    },
    handler: async (request) => {
      const actor = request.opsAuth;
      if (actor === undefined) {
        throw new Error("ops audience guard did not set opsAuth");
      }
      const query = request.query as { page: number; pageSize: number };
      const result = await request.server.licensing.listPayments.execute({
        organizationId: OrganizationId.parse(actor.tenantId),
        page: query.page,
        pageSize: query.pageSize,
      });
      return {
        items: result.items.map((row) => ({
          id: row.id,
          subscriptionId: row.subscriptionId,
          providerRef: row.providerRef,
          amountCents: row.amountCents,
        })),
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
      };
    },
  });
}
