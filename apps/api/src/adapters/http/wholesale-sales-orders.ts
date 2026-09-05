import type { FastifyInstance, FastifyReply } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { SalesOrder } from "@dc-inventory/sales";
import { z } from "zod";
import {
  OrderId,
  StaffUserId,
  WholesaleUserId,
} from "@dc-inventory/shared-kernel";
import {
  conflictResponseSchema,
  invalidResponseSchema,
  needsCustomerResponseSchema,
  notFoundResponseSchema,
  salesOrderIdParamsSchema,
  salesOrderItemSchema,
  salesOrderListQuerySchema,
  salesOrderListResponseSchema,
  unauthorizedResponseSchema,
  wholesaleSalesOrderWriteBodySchema,
  salesOrderReplaceLinesBodySchema,
  zodValidationErrorResponseSchema,
} from "../../schemas.js";
import { wholesaleCustomerId, wholesaleOrganizationId } from "./org-session.js";

function typed(app: FastifyInstance) {
  return app.withTypeProvider<ZodTypeProvider>();
}

const STAFF_USER_ID_SENTINEL = StaffUserId.parse("00000000-0000-4000-8000-000000000000");

type WholesaleAuth = {
  mode: "buyer" | "staff_acting";
  staffUserId: string | null;
  wholesaleUserId: string | null;
  customerId: string | null;
};

function wholesaleStaffUserId(request: { wholesaleAuth?: WholesaleAuth }): StaffUserId {
  if (request.wholesaleAuth?.mode === "staff_acting") {
    return StaffUserId.parse(request.wholesaleAuth.staffUserId ?? "");
  }
  return STAFF_USER_ID_SENTINEL;
}

function wholesaleCreateInput(request: { wholesaleAuth?: WholesaleAuth }) {
  const customerId = wholesaleCustomerId(request);
  if (request.wholesaleAuth?.mode === "staff_acting") {
    return {
      customerId,
      placedByStaffUserId: StaffUserId.parse(request.wholesaleAuth.staffUserId ?? ""),
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

  routes.get(
    "/sales-orders",
    {
      schema: {
        operationId: "listWholesaleSalesOrders",
        tags: ["wholesale"],
        summary: "List sales orders for session customer",
        querystring: salesOrderListQuerySchema.omit({ customerId: true }),
        response: {
          200: salesOrderListResponseSchema,
          400: zodValidationErrorResponseSchema,
          401: unauthorizedResponseSchema,
          403: needsCustomerResponseSchema,
        },
      },
    },
    async (request) => {
      const query = request.query as {
        q?: string;
        page: number;
        pageSize: number;
        sortBy: "documentNumber" | "status";
        sortOrder: "asc" | "desc";
        status?: SalesOrder["status"];
      };
      const result = await request.server.sales.listSalesOrders.execute({
        organizationId: wholesaleOrganizationId(request),
        staffUserId: wholesaleStaffUserId(request),
        customerId: wholesaleCustomerId(request),
        q: query.q,
        page: query.page,
        pageSize: query.pageSize,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
        status: query.status,
      });
      return {
        items: result.items.map(mapSalesOrder),
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
      };
    },
  );

  routes.get(
    "/sales-orders/:id",
    {
      schema: {
        operationId: "getWholesaleSalesOrder",
        tags: ["wholesale"],
        summary: "Get sales order for session customer",
        params: salesOrderIdParamsSchema,
        response: {
          200: salesOrderItemSchema,
          401: unauthorizedResponseSchema,
          403: needsCustomerResponseSchema,
          404: notFoundResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await request.server.sales.getSalesOrder.execute({
        organizationId: wholesaleOrganizationId(request),
        staffUserId: wholesaleStaffUserId(request),
        salesOrderId: OrderId.parse(request.params.id),
      });
      if (!result.ok) {
        return sendNotFound(reply);
      }
      if (result.salesOrder.customerId !== wholesaleCustomerId(request)) {
        return sendNotFound(reply);
      }
      return mapSalesOrder(result.salesOrder);
    },
  );

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
      const actor = wholesaleCreateInput(request);
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

  routes.patch(
    "/sales-orders/:id",
    {
      schema: {
        operationId: "replaceWholesaleSalesOrderLines",
        tags: ["wholesale"],
        summary: "Replace lines on a draft sales order",
        params: salesOrderIdParamsSchema,
        body: salesOrderReplaceLinesBodySchema,
        response: {
          200: salesOrderItemSchema,
          400: z.union([invalidResponseSchema, zodValidationErrorResponseSchema]),
          401: unauthorizedResponseSchema,
          403: needsCustomerResponseSchema,
          404: notFoundResponseSchema,
          409: conflictResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const actor = wholesaleCreateInput(request);
      const result = await request.server.sales.replaceSalesOrderLines.execute({
        organizationId: wholesaleOrganizationId(request),
        ...actor,
        salesOrderId: OrderId.parse(request.params.id),
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
          result.reason === "not_found" ||
          result.reason === "customer_not_found" ||
          result.reason === "product_not_found" ||
          result.reason === "product_organization_mismatch"
        ) {
          return sendNotFound(reply);
        }
        if (result.reason === "illegal_transition" || result.reason === "product_inactive") {
          return reply.code(409).send({ error: "conflict" as const });
        }
        if (result.reason === "customer_inactive") {
          return reply.code(409).send({ error: "conflict" as const });
        }
        return reply.code(400).send({ error: "invalid" as const });
      }
      if (result.salesOrder.customerId !== wholesaleCustomerId(request)) {
        return sendNotFound(reply);
      }
      return mapSalesOrder(result.salesOrder);
    },
  );
}
