import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import {
  licensingListQuerySchema,
  licensingPaymentListResponseSchema,
  licensingSubscriptionListResponseSchema,
  unauthorizedResponseSchema,
} from "../../schemas.js";
import { staffOrganizationId } from "./org-session.js";

function typed(app: FastifyInstance) {
  return app.withTypeProvider<ZodTypeProvider>();
}

export function registerInternalLicensingRoutes(app: FastifyInstance): void {
  const routes = typed(app);

  routes.get(
    "/licensing/subscriptions",
    {
      schema: {
        operationId: "listInternalLicensingSubscriptions",
        tags: ["internal"],
        summary: "List software subscriptions for the staff session organization",
        querystring: licensingListQuerySchema,
        response: {
          200: licensingSubscriptionListResponseSchema,
          401: unauthorizedResponseSchema,
        },
      },
    },
    async (request) => {
      const query = request.query as { page: number; pageSize: number };
      const result = await request.server.licensing.listSubscriptions.execute({
        organizationId: staffOrganizationId(request),
        page: query.page,
        pageSize: query.pageSize,
      });
      return {
        items: result.items.map((row) => ({
          id: row.id,
          plan: row.plan,
          status: row.status,
        })),
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
      };
    },
  );

  routes.get(
    "/licensing/payments",
    {
      schema: {
        operationId: "listInternalLicensingPayments",
        tags: ["internal"],
        summary: "List software subscription payments for the staff session organization",
        querystring: licensingListQuerySchema,
        response: {
          200: licensingPaymentListResponseSchema,
          401: unauthorizedResponseSchema,
        },
      },
    },
    async (request) => {
      const query = request.query as { page: number; pageSize: number };
      const result = await request.server.licensing.listPayments.execute({
        organizationId: staffOrganizationId(request),
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
  );
}
