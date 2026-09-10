import type { FastifyInstance, FastifyReply } from "fastify";
import type { FastifySchema } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import type { SalesOrder } from "@dc-inventory/sales";
import { CustomerId, OrderId, StaffUserId } from "@dc-inventory/shared-kernel";
import {
  mapSalesOrder,
  mapSalesOrderListItems,
  toCreditExceededBody,
  toInsufficientAtpBody,
  toInsufficientCoverBody,
} from "./map-sales-order.js";
import {
  conflictResponseSchema,
  creditExceededResponseSchema,
  insufficientAtpResponseSchema,
  insufficientCoverResponseSchema,
  invalidResponseSchema,
  notFoundResponseSchema,
  salesOrderCommandBodySchema,
  salesOrderStaffConfirmBodySchema,
  salesOrderIdParamsSchema,
  salesOrderItemSchema,
  salesOrderListQuerySchema,
  salesOrderListResponseSchema,
  salesOrderReplaceLinesBodySchema,
  salesOrderLineDeltasBodySchema,
  salesOrderWriteBodySchema,
  salesOrdersListTable,
  shipRefusedResponseSchema,
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

function lookupProductIds(request: {
  server: FastifyInstance;
  staffAuth?: { staffUserId: string; organizationId: string };
}): (skus: readonly string[]) => Promise<ReadonlyMap<string, string | null>> {
  const organizationId = staffOrganizationId(request);
  return (skus) => request.server.catalog.lookupProductIdsBySkus(organizationId, skus);
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
  return mapSalesOrder(
    order,
    lookupProductId(request),
    lookupCustomerName(request),
    lookupProductIds(request),
  );
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

function sendInsufficientCover(
  reply: FastifyReply,
  result: Parameters<typeof toInsufficientCoverBody>[0],
) {
  return reply.code(409).send(toInsufficientCoverBody(result));
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
      return {
        items: await mapSalesOrderListItems(
          result.items,
          lookupProductId(request),
          lookupCustomerName(request),
          lookupProductIds(request),
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
        label: request.body.label,
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

  routes.post(
    "/sales-orders/:id/line-jobs",
    {
      schema: {
        operationId: "applyInternalSalesOrderLineDeltas",
        tags: ["internal"],
        summary: "Apply line deltas on a draft sales order",
        params: salesOrderIdParamsSchema,
        body: salesOrderLineDeltasBodySchema,
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
      const result = await request.server.sales.applySalesOrderLineDeltas.execute({
        organizationId: staffOrganizationId(request),
        staffUserId: staffUserId(request),
        salesOrderId: OrderId.parse(request.params.id),
        add: request.body.add,
        update: request.body.update,
        remove: request.body.remove,
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
        body: salesOrderStaffConfirmBodySchema,
        response: {
          200: salesOrderItemSchema,
          400: invalidResponseSchema,
          401: unauthorizedResponseSchema,
          404: notFoundResponseSchema,
          409: z.union([
            conflictResponseSchema,
            insufficientAtpResponseSchema,
            creditExceededResponseSchema,
          ]),
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
        overrideCredit: request.body.overrideCredit,
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
        if (result.reason === "credit_exceeded") {
          return reply.code(409).send(toCreditExceededBody(result));
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
          409: z.union([
            conflictResponseSchema,
            insufficientCoverResponseSchema,
            shipRefusedResponseSchema,
          ]),
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
        if (result.reason === "insufficient_cover") {
          return sendInsufficientCover(reply, result);
        }
        if (result.reason === "bill_to_missing") {
          return reply.code(409).send({ error: "bill_to_missing" as const });
        }
        if (result.reason === "accounting_invalid") {
          return reply.code(409).send({ error: "accounting_invalid" as const });
        }
        if (result.reason === "illegal_transition") {
          return reply.code(409).send({ error: "illegal_transition" as const });
        }
        if (result.reason === "idempotency_conflict" || result.reason === "inventory_conflict") {
          return sendConflict(reply);
        }
        return sendInvalid(reply);
      }
      return toSalesOrderBody(request, result.salesOrder);
    },
  );
}
