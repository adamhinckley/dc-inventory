import type { FastifyInstance, FastifyReply } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { SalesOrder } from "@dc-inventory/sales";
import { z } from "zod";
import {
  StaffUserId,
  WholesaleUserId,
} from "@dc-inventory/shared-kernel";
import {
  conflictResponseSchema,
  invalidResponseSchema,
  needsCustomerResponseSchema,
  notFoundResponseSchema,
  salesOrderItemSchema,
  unauthorizedResponseSchema,
  wholesaleSalesOrderWriteBodySchema,
  zodValidationErrorResponseSchema,
} from "../../schemas.js";
import { wholesaleCustomerId, wholesaleOrganizationId } from "./org-session.js";

function typed(app: FastifyInstance) {
  return app.withTypeProvider<ZodTypeProvider>();
}

function wholesaleSalesOrderActor(request: {
  wholesaleAuth?: {
    mode: "buyer" | "staff_acting";
    staffUserId: string | null;
    wholesaleUserId: string | null;
    customerId: string | null;
  };
}) {
  const customerId = wholesaleCustomerId(request);
  if (request.wholesaleAuth?.mode === "staff_acting") {
    return {
      customerId,
      staffUserId: StaffUserId.parse(request.wholesaleAuth.staffUserId ?? ""),
    };
  }
  return {
    customerId,
    wholesaleUserId: WholesaleUserId.parse(request.wholesaleAuth?.wholesaleUserId ?? ""),
  };
}

function mapSalesOrder(order: SalesOrder) {
  return {
    id: order.id,
    customerId: order.customerId,
    documentNumber: order.documentNumber,
    status: order.status,
    shipLine1: order.shipLine1,
    shipLine2: order.shipLine2,
    shipCity: order.shipCity,
    shipRegion: order.shipRegion,
    shipPostal: order.shipPostal,
    shipCountry: order.shipCountry,
    lines: order.lines.map((line) => ({
      id: line.id,
      sku: line.sku.value,
      name: line.name,
      qty: line.qty,
      unitPriceCents: line.unitPrice.amountMinor,
      currency: line.unitPrice.currency,
      taxCategoryCode: line.taxCategoryCode,
    })),
  };
}

function sendNotFound(reply: FastifyReply) {
  return reply.code(404).send({ error: "not_found" as const });
}

export function registerWholesaleSalesOrderRoutes(app: FastifyInstance): void {
  const routes = typed(app);

  routes.post(
    "/sales-orders",
    {
      schema: {
        operationId: "createWholesaleSalesOrder",
        tags: ["wholesale"],
        summary: "Create draft sales order",
        body: wholesaleSalesOrderWriteBodySchema,
        response: {
          201: salesOrderItemSchema,
          400: z.union([invalidResponseSchema, zodValidationErrorResponseSchema]),
          401: unauthorizedResponseSchema,
          403: needsCustomerResponseSchema,
          404: notFoundResponseSchema,
          409: conflictResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const actor = wholesaleSalesOrderActor(request);
      const result = await request.server.sales.createSalesOrder.execute({
        organizationId: wholesaleOrganizationId(request),
        ...actor,
        lines: request.body.lines,
        shipLine1: request.body.shipLine1,
        shipLine2: request.body.shipLine2,
        shipCity: request.body.shipCity,
        shipRegion: request.body.shipRegion,
        shipPostal: request.body.shipPostal,
        shipCountry: request.body.shipCountry,
      });
      if (!result.ok) {
        if (
          result.reason === "customer_not_found" ||
          result.reason === "product_not_found" ||
          result.reason === "product_organization_mismatch"
        ) {
          return sendNotFound(reply);
        }
        if (result.reason === "product_inactive") {
          return reply.code(409).send({ error: "conflict" as const });
        }
        if (result.reason === "customer_inactive") {
          return reply.code(409).send({ error: "conflict" as const });
        }
        return reply.code(400).send({ error: "invalid" as const });
      }
      return reply.code(201).send(mapSalesOrder(result.salesOrder));
    },
  );
}
