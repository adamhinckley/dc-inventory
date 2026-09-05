import type { FastifyInstance, FastifyReply } from "fastify";
import type { FastifySchema } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import type { SalesOrder } from "@dc-inventory/sales";
import { CustomerId, OrderId, StaffUserId } from "@dc-inventory/shared-kernel";
import { mapSalesOrder, toInsufficientAtpBody } from "./map-sales-order.js";
import {
  conflictResponseSchema,
  insufficientAtpResponseSchema,
  invalidResponseSchema,
  notFoundResponseSchema,
  salesOrderCommandBodySchema,
  salesOrderConfirmBodySchema,
  salesOrderIdParamsSchema,
  salesOrderItemSchema,
  salesOrderListQuerySchema,
  salesOrderListResponseSchema,
  salesOrderReplaceLinesBodySchema,
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

import { staffOrganizationId } from "./org-session.js";

function lookupProductId(request: {
  server: FastifyInstance;
  staffAuth?: { staffUserId: string; organizationId: string };
}): (sku: string) => Promise<string | null> {
  const organizationId = staffOrganizationId(request);
  return (sku) => request.server.catalog.lookupProductIdBySku(organizationId, sku);
}

function lookupCustomerName(request: {
  server: FastifyInstance;
  staffAuth?: { staffUserId: string; organizationId: string };
}): (customerId: string) => Promise<string | null> {
  const organizationId = staffOrganizationId(request);
  const cache = new Map<string, Promise<string | null>>();
  return (customerId) => {
    const cached = cache.get(customerId);
    if (cached !== undefined) {
      return cached;
    }
    const pending = request.server.customers.getCustomer
      .execute({
        organizationId,
        staffUserId: staffUserId(request),
        customerId: CustomerId.parse(customerId),
      })
      .then((result) => (result.ok ? result.customer.name : null));
    cache.set(customerId, pending);
    return pending;
  };
}

function toSalesOrderBody(
  request: {
    server: FastifyInstance;
    staffAuth?: { staffUserId: string; organizationId: string };
  },
  order: SalesOrder,
) {
  return mapSalesOrder(order, lookupProductId(request), lookupCustomerName(request));
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

function sendInsufficientAtp(
  reply: FastifyReply,
  result: Parameters<typeof toInsufficientAtpBody>[0],
) {
  return reply.code(409).send(toInsufficientAtpBody(result));
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
          400: zodValidationErrorResponseSchema,
          401: unauthorizedResponseSchema,
        },
        "x-table": salesOrdersListTable,
      } as FastifySchema & { "x-table": typeof salesOrdersListTable },
    },
    async (request) => {
      const query = request.query as {
        q?: string;
        page: number;
        pageSize: number;
        sortBy: "documentNumber" | "status";
        sortOrder: "asc" | "desc";
        status?: SalesOrder["status"];
        customerId?: string;
      };
      const result = await request.server.sales.listSalesOrders.execute({
        organizationId: staffOrganizationId(request),
        staffUserId: staffUserId(request),
        q: query.q,
        page: query.page,
        pageSize: query.pageSize,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
        status: query.status,
        customerId:
          query.customerId === undefined ? undefined : CustomerId.parse(query.customerId),
      });
      const productIdBySku = lookupProductId(request);
      const nameByCustomerId = lookupCustomerName(request);
      return {
        items: await Promise.all(
          result.items.map((order) =>
            mapSalesOrder(order, productIdBySku, nameByCustomerId),
          ),
        ),
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
          409: z.union([conflictResponseSchema, insufficientAtpResponseSchema]),
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
        if (
          result.reason === "customer_not_found" ||
          result.reason === "product_not_found" ||
          result.reason === "product_organization_mismatch"
        ) {
          return sendNotFound(reply);
        }
        if (result.reason === "insufficient_atp") {
          return sendInsufficientAtp(reply, result);
        }
        if (result.reason === "product_inactive") {
          return sendConflict(reply);
        }
        if (result.reason === "customer_on_hold" || result.reason === "customer_inactive") {
          return sendConflict(reply);
        }
        if (result.reason === "empty_order") {
          return sendInvalid(reply);
        }
        return sendInvalid(reply);
      }
      return reply.code(201).send(
        await toSalesOrderBody(request, result.salesOrder),
      );
    },
  );

  routes.patch(
    "/sales-orders/:id",
    {
      schema: {
        operationId: "replaceInternalSalesOrderLines",
        tags: ["internal"],
        summary: "Replace lines on a draft sales order",
        params: salesOrderIdParamsSchema,
        body: salesOrderReplaceLinesBodySchema,
        response: {
          200: salesOrderItemSchema,
          400: z.union([invalidResponseSchema, zodValidationErrorResponseSchema]),
          401: unauthorizedResponseSchema,
          404: notFoundResponseSchema,
          409: z.union([conflictResponseSchema, insufficientAtpResponseSchema]),
        },
      },
    },
    async (request, reply) => {
      const result = await request.server.sales.replaceSalesOrderLines.execute({
        organizationId: staffOrganizationId(request),
        staffUserId: staffUserId(request),
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
        if (result.reason === "insufficient_atp") {
          return sendInsufficientAtp(reply, result);
        }
        if (
          result.reason === "illegal_transition" ||
          result.reason === "product_inactive" ||
          result.reason === "customer_on_hold" ||
          result.reason === "customer_inactive"
        ) {
          return sendConflict(reply);
        }
        return sendInvalid(reply);
      }
      return toSalesOrderBody(request, result.salesOrder);
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
      return toSalesOrderBody(request, result.salesOrder);
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
        body: salesOrderConfirmBodySchema,
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
        shipToId: request.body.shipToId,
      });
      if (!result.ok) {
        if (
          result.reason === "not_found" ||
          result.reason === "customer_not_found" ||
          result.reason === "ship_to_not_found"
        ) {
          return sendNotFound(reply);
        }
        if (result.reason === "insufficient_atp") {
          return sendInsufficientAtp(reply, result);
        }
        if (
          result.reason === "illegal_transition" ||
          result.reason === "idempotency_conflict" ||
          result.reason === "inventory_conflict" ||
          result.reason === "customer_on_hold" ||
          result.reason === "customer_inactive"
        ) {
          return sendConflict(reply);
        }
        return sendInvalid(reply);
      }
      return toSalesOrderBody(request, result.salesOrder);
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
      return toSalesOrderBody(request, result.salesOrder);
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
          result.reason === "accounting_invalid" ||
          result.reason === "bill_to_missing"
        ) {
          return sendConflict(reply);
        }
        return sendInvalid(reply);
      }
      return toSalesOrderBody(request, result.salesOrder);
    },
  );
}
