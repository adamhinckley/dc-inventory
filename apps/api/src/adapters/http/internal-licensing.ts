import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import {
  licensingPaymentListResponseSchema,
  licensingSubscriptionListResponseSchema,
  unauthorizedResponseSchema,
} from "../../schemas.js";
import type { InMemoryLicensingStore } from "../../licensing/in-memory-licensing.js";
import { staffOrganizationId } from "./org-session.js";

function typed(app: FastifyInstance) {
  return app.withTypeProvider<ZodTypeProvider>();
}

export function registerInternalLicensingRoutes(
  app: FastifyInstance,
  licensingStore: InMemoryLicensingStore,
): void {
  const routes = typed(app);

  routes.get(
    "/licensing/subscriptions",
    {
      schema: {
        operationId: "listInternalLicensingSubscriptions",
        tags: ["internal"],
        summary: "List software subscriptions for the staff session organization",
        response: {
          200: licensingSubscriptionListResponseSchema,
          401: unauthorizedResponseSchema,
        },
      },
    },
    async (request) => {
      const organizationId = staffOrganizationId(request);
      const items = licensingStore.listSubscriptions(organizationId).map((row) => ({
        id: row.id,
        plan: row.plan,
        status: row.status,
      }));
      return { items };
    },
  );

  routes.get(
    "/licensing/payments",
    {
      schema: {
        operationId: "listInternalLicensingPayments",
        tags: ["internal"],
        summary: "List software subscription payments for the staff session organization",
        response: {
          200: licensingPaymentListResponseSchema,
          401: unauthorizedResponseSchema,
        },
      },
    },
    async (request) => {
      const organizationId = staffOrganizationId(request);
      const items = licensingStore.listPayments(organizationId).map((row) => ({
        id: row.id,
        subscriptionId: row.subscriptionId,
        providerRef: row.providerRef,
        amountCents: row.amountCents,
      }));
      return { items };
    },
  );
}
