import type { FastifyInstance, FastifyReply } from "fastify";
import type { FastifySchema } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import type { SalesOrder } from "@dc-inventory/sales";
import { CustomerId, OrderId, OrganizationId, StaffUserId } from "@dc-inventory/shared-kernel";
import {
  conflictResponseSchema,
  insufficientAtpResponseSchema,
  invalidResponseSchema,
  notFoundResponseSchema,
  salesOrderCommandBodySchema,
  salesOrderIdParamsSchema,
  salesOrderItemSchema,
  salesOrderListQuerySchema,
  salesOrderListResponseSchema,
  salesOrderWriteBodySchema,
  salesOrdersListTable,
  unauthorizedResponseSchema,
  zodValidationErrorResponseSchema,
} from "../../schemas.js";

function typed(app: FastifyInstance) {
  return app.withTypeProvider<ZodTypeProvider>();
}

function staffUserId(request: { staffAuth?: { staffUserId: string } }): StaffUserId {
  return StaffUserId.parse(request.staffAuth?.staffUserId ?? "");
}

function staffOrganizationId(request: { staffAuth?: { organizationId: string } }): OrganizationId {
  return OrganizationId.parse(request.staffAuth?.organizationId ?? OrganizationId.DEFAULT);
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

function sendInvalid(reply: FastifyReply) {
  return reply.code(400).send({ error: "invalid" as const });
}

function sendConflict(reply: FastifyReply) {
  return reply.code(409).send({ error: "conflict" as const });
}

function sendInsufficientAtp(reply: FastifyReply) {
  return reply.code(409).send({ error: "insufficient_atp" as const });
}

const readErrors = {
  401: unauthorizedResponseSchema,
  404: notFoundResponseSchema,
};

export function registerInternalSalesOrderRoutes(app: FastifyInstance): void {
  const routes = typed(app);

  routes.get(
    "/sales-orders",
    {
      schema: {
        operationId: "listInternalSalesOrders",
        tags: ["internal"],
        summary: "List sales orders",
        querystring: salesOrderListQuerySchema,
        response: {
          200: salesOrderListResponseSchema,
          401: unauthorizedResponseSchema,
        },
        "x-table": salesOrdersListTable,
      } as FastifySchema & { "x-table": typeof salesOrdersListTable },
    },
    async (request) => {
      const query = request.query as {
        page: number;
        pageSize: number;
        status?: SalesOrder["status"];
        customerId?: string;
      };
      const result = await request.server.sales.listSalesOrders.execute({
        organizationId: staffOrganizationId(request),
        staffUserId: staffUserId(request),
        page: query.page,
        pageSize: query.pageSize,
        status: query.status,
        customerId:
          query.customerId === undefined ? undefined : CustomerId.parse(query.customerId),
      });
      return {
        items: result.items.map(mapSalesOrder),
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
      };
    },
  );

  routes.post(
    "/sales-orders",
    {
      schema: {
        operationId: "createInternalSalesOrder",
        tags: ["internal"],
        summary: "Create draft sales order",
        body: salesOrderWriteBodySchema,
        response: {
          201: salesOrderItemSchema,
          400: z.union([invalidResponseSchema, zodValidationErrorResponseSchema]),
          401: unauthorizedResponseSchema,
          404: notFoundResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await request.server.sales.createSalesOrder.execute({
        organizationId: staffOrganizationId(request),
        staffUserId: staffUserId(request),
        customerId: CustomerId.parse(request.body.customerId),
        lines: request.body.lines,
        shipLine1: request.body.shipLine1,
        shipLine2: request.body.shipLine2,
        shipCity: request.body.shipCity,
        shipRegion: request.body.shipRegion,
        shipPostal: request.body.shipPostal,
        shipCountry: request.body.shipCountry,
      });
      if (!result.ok) {
        if (result.reason === "customer_not_found") {
          return sendNotFound(reply);
        }
        if (result.reason === "empty_order") {
          return sendInvalid(reply);
        }
        return sendInvalid(reply);
      }
      return reply.code(201).send(mapSalesOrder(result.salesOrder));
    },
  );

  routes.get(
    "/sales-orders/:id",
    {
      schema: {
        operationId: "getInternalSalesOrder",
        tags: ["internal"],
        summary: "Get sales order",
        params: salesOrderIdParamsSchema,
        response: {
          200: salesOrderItemSchema,
          ...readErrors,
        },
      },
    },
    async (request, reply) => {
      const result = await request.server.sales.getSalesOrder.execute({
        organizationId: staffOrganizationId(request),
        staffUserId: staffUserId(request),
        salesOrderId: OrderId.parse(request.params.id),
      });
      if (!result.ok) {
        return sendNotFound(reply);
      }
      return mapSalesOrder(result.salesOrder);
    },
  );

  routes.post(
    "/sales-orders/:id/confirm",
    {
      schema: {
        operationId: "confirmInternalSalesOrder",
        tags: ["internal"],
        summary: "Confirm sales order and allocate inventory",
        params: salesOrderIdParamsSchema,
        body: salesOrderCommandBodySchema,
        response: {
          200: salesOrderItemSchema,
          400: invalidResponseSchema,
          401: unauthorizedResponseSchema,
          404: notFoundResponseSchema,
          409: z.union([conflictResponseSchema, insufficientAtpResponseSchema]),
        },
      },
    },
    async (request, reply) => {
      const result = await request.server.sales.confirmSalesOrder.execute({
        organizationId: staffOrganizationId(request),
        staffUserId: staffUserId(request),
        salesOrderId: OrderId.parse(request.params.id),
        idempotencyKey: request.body.idempotencyKey,
      });
      if (!result.ok) {
        if (result.reason === "not_found") {
          return sendNotFound(reply);
        }
        if (result.reason === "insufficient_atp") {
          return sendInsufficientAtp(reply);
        }
        if (
          result.reason === "illegal_transition" ||
          result.reason === "idempotency_conflict" ||
          result.reason === "inventory_conflict"
        ) {
          return sendConflict(reply);
        }
        return sendInvalid(reply);
      }
      return mapSalesOrder(result.salesOrder);
    },
  );

  routes.post(
    "/sales-orders/:id/cancel",
    {
      schema: {
        operationId: "cancelInternalSalesOrder",
        tags: ["internal"],
        summary: "Cancel draft or confirmed unshipped sales order",
        params: salesOrderIdParamsSchema,
        body: salesOrderCommandBodySchema,
        response: {
          200: salesOrderItemSchema,
          401: unauthorizedResponseSchema,
          404: notFoundResponseSchema,
          409: conflictResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await request.server.sales.cancelSalesOrder.execute({
        organizationId: staffOrganizationId(request),
        staffUserId: staffUserId(request),
        salesOrderId: OrderId.parse(request.params.id),
        idempotencyKey: request.body.idempotencyKey,
      });
      if (!result.ok) {
        if (result.reason === "not_found") {
          return sendNotFound(reply);
        }
        if (
          result.reason === "illegal_transition" ||
          result.reason === "idempotency_conflict" ||
          result.reason === "inventory_conflict"
        ) {
          return sendConflict(reply);
        }
        return sendNotFound(reply);
      }
      return mapSalesOrder(result.salesOrder);
    },
  );

  routes.post(
    "/sales-orders/:id/ship",
    {
      schema: {
        operationId: "shipInternalSalesOrder",
        tags: ["internal"],
        summary: "Ship confirmed sales order and post zero-tax invoice",
        params: salesOrderIdParamsSchema,
        body: salesOrderCommandBodySchema,
        response: {
          200: salesOrderItemSchema,
          400: invalidResponseSchema,
          401: unauthorizedResponseSchema,
          404: notFoundResponseSchema,
          409: conflictResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await request.server.sales.shipSalesOrder.execute({
        organizationId: staffOrganizationId(request),
        staffUserId: staffUserId(request),
        salesOrderId: OrderId.parse(request.params.id),
        idempotencyKey: request.body.idempotencyKey,
      });
      if (!result.ok) {
        if (result.reason === "not_found") {
          return sendNotFound(reply);
        }
        if (
          result.reason === "illegal_transition" ||
          result.reason === "idempotency_conflict" ||
          result.reason === "inventory_conflict" ||
          result.reason === "accounting_invalid"
        ) {
          return sendConflict(reply);
        }
        return sendInvalid(reply);
      }
      return mapSalesOrder(result.salesOrder);
    },
  );
}
