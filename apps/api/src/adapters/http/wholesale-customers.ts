import type { FastifyInstance, FastifyReply } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import type { Customer } from "@dc-inventory/customers";
import { CustomerId, WholesaleUserId } from "@dc-inventory/shared-kernel";
import {
  invalidResponseSchema,
  notFoundResponseSchema,
  unauthorizedResponseSchema,
  wholesaleCustomerItemSchema,
  wholesaleCustomerNotePatchBodySchema,
  zodValidationErrorResponseSchema,
} from "../../schemas.js";
import { wholesaleOrganizationId } from "./org-session.js";

function typed(app: FastifyInstance) {
  return app.withTypeProvider<ZodTypeProvider>();
}

function wholesaleIdentity(request: {
  wholesaleAuth?: { customerId: string; wholesaleUserId: string };
}) {
  return {
    customerId: CustomerId.parse(request.wholesaleAuth?.customerId ?? ""),
    wholesaleUserId: WholesaleUserId.parse(
      request.wholesaleAuth?.wholesaleUserId ?? "",
    ),
  };
}

function mapWholesaleCustomer(customer: Customer) {
  return {
    id: customer.id,
    name: customer.name,
    customerNumber: customer.customerNumber,
    creditLimitCents: customer.creditLimit.amountMinor,
    currency: customer.creditLimit.currency,
    terms: customer.terms,
    taxId: customer.taxId,
    accountStatus: customer.accountStatus,
    customerNote: customer.customerNote,
    createdAt: customer.createdAt.toISOString(),
  };
}

function sendNotFound(reply: FastifyReply) {
  return reply.code(404).send({ error: "not_found" as const });
}

export function registerWholesaleCustomerRoutes(app: FastifyInstance): void {
  const routes = typed(app);

  routes.get(
    "/account",
    {
      schema: {
        operationId: "getWholesaleAccount",
        tags: ["wholesale"],
        summary: "Read own customer account",
        response: {
          200: wholesaleCustomerItemSchema,
          401: unauthorizedResponseSchema,
          404: notFoundResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const identity = wholesaleIdentity(request);
      const result = await request.server.customers.getWholesaleCustomer.execute({
        organizationId: wholesaleOrganizationId(request),
        wholesaleUserId: identity.wholesaleUserId,
        customerId: identity.customerId,
      });
      if (!result.ok) {
        return sendNotFound(reply);
      }
      return mapWholesaleCustomer(result.customer);
    },
  );

  routes.patch(
    "/account",
    {
      schema: {
        operationId: "updateWholesaleAccountCustomerNote",
        tags: ["wholesale"],
        summary: "Edit own customer note",
        body: wholesaleCustomerNotePatchBodySchema,
        response: {
          200: wholesaleCustomerItemSchema,
          400: z.union([invalidResponseSchema, zodValidationErrorResponseSchema]),
          401: unauthorizedResponseSchema,
          404: notFoundResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const identity = wholesaleIdentity(request);
      const result = await request.server.customers.updateWholesaleCustomerNote.execute({
        organizationId: wholesaleOrganizationId(request),
        wholesaleUserId: identity.wholesaleUserId,
        customerId: identity.customerId,
        customerNote: request.body.customerNote,
      });
      if (!result.ok) {
        return sendNotFound(reply);
      }
      return mapWholesaleCustomer(result.customer);
    },
  );
}
