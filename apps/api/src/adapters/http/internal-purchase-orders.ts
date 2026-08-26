import type { FastifyInstance, FastifyReply } from "fastify";
import type { FastifySchema } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { PurchaseOrderLineId, type PurchaseOrder } from "@dc-inventory/purchasing";
import { PurchaseOrderId, OrganizationId, StaffUserId, SupplierId } from "@dc-inventory/shared-kernel";
import {
  conflictResponseSchema,
  invalidResponseSchema,
  notFoundResponseSchema,
  purchaseOrderCommandBodySchema,
  purchaseOrderIdParamsSchema,
  purchaseOrderItemSchema,
  purchaseOrderListQuerySchema,
  purchaseOrderListResponseSchema,
  purchaseOrderReceiveBodySchema,
  purchaseOrderWriteBodySchema,
  purchaseOrdersListTable,
  unauthorizedResponseSchema,
  zodValidationErrorResponseSchema,
} from "../../schemas.js";

function typed(app: FastifyInstance) {
  return app.withTypeProvider<ZodTypeProvider>();
}

function staffUserId(request: { staffAuth?: { staffUserId: string } }): StaffUserId {
  return StaffUserId.parse(request.staffAuth?.staffUserId ?? "");
}

function mapPurchaseOrder(order: PurchaseOrder) {
  return {
    id: order.id,
    supplierId: order.supplierId,
    documentNumber: order.documentNumber,
    status: order.status,
    lines: order.lines.map((line) => ({
      id: line.id,
      sku: line.sku.value,
      name: line.name,
      qty: line.qty,
      receivedQty: line.receivedQty,
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

const readErrors = {
  401: unauthorizedResponseSchema,
  404: notFoundResponseSchema,
};

export function registerInternalPurchaseOrderRoutes(app: FastifyInstance): void {
  const routes = typed(app);

  routes.get(
    "/purchase-orders",
    {
      schema: {
        operationId: "listInternalPurchaseOrders",
        tags: ["internal"],
        summary: "List purchase orders",
        querystring: purchaseOrderListQuerySchema,
        response: {
          200: purchaseOrderListResponseSchema,
          401: unauthorizedResponseSchema,
        },
        "x-table": purchaseOrdersListTable,
      } as FastifySchema & { "x-table": typeof purchaseOrdersListTable },
    },
    async (request) => {
      const query = request.query as {
        page: number;
        pageSize: number;
        status?: PurchaseOrder["status"];
        supplierId?: string;
      };
      const result = await request.server.purchasing.listPurchaseOrders.execute({
        organizationId: OrganizationId.DEFAULT,
        staffUserId: staffUserId(request),
        page: query.page,
        pageSize: query.pageSize,
        status: query.status,
        supplierId:
          query.supplierId === undefined ? undefined : SupplierId.parse(query.supplierId),
      });
      return {
        items: result.items.map(mapPurchaseOrder),
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
      };
    },
  );

  routes.post(
    "/purchase-orders",
    {
      schema: {
        operationId: "createInternalPurchaseOrder",
        tags: ["internal"],
        summary: "Create draft purchase order",
        body: purchaseOrderWriteBodySchema,
        response: {
          201: purchaseOrderItemSchema,
          400: z.union([invalidResponseSchema, zodValidationErrorResponseSchema]),
          401: unauthorizedResponseSchema,
          404: notFoundResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await request.server.purchasing.createPurchaseOrder.execute({
        organizationId: OrganizationId.DEFAULT,
        staffUserId: staffUserId(request),
        supplierId: SupplierId.parse(request.body.supplierId),
        lines: request.body.lines,
      });
      if (!result.ok) {
        if (result.reason === "supplier_not_found") {
          return sendNotFound(reply);
        }
        if (result.reason === "empty_order") {
          return sendInvalid(reply);
        }
        return sendInvalid(reply);
      }
      return reply.code(201).send(mapPurchaseOrder(result.purchaseOrder));
    },
  );

  routes.get(
    "/purchase-orders/:id",
    {
      schema: {
        operationId: "getInternalPurchaseOrder",
        tags: ["internal"],
        summary: "Get purchase order",
        params: purchaseOrderIdParamsSchema,
        response: {
          200: purchaseOrderItemSchema,
          ...readErrors,
        },
      },
    },
    async (request, reply) => {
      const result = await request.server.purchasing.getPurchaseOrder.execute({
        organizationId: OrganizationId.DEFAULT,
        staffUserId: staffUserId(request),
        purchaseOrderId: PurchaseOrderId.parse(request.params.id),
      });
      if (!result.ok) {
        return sendNotFound(reply);
      }
      return mapPurchaseOrder(result.purchaseOrder);
    },
  );

  routes.post(
    "/purchase-orders/:id/confirm",
    {
      schema: {
        operationId: "confirmInternalPurchaseOrder",
        tags: ["internal"],
        summary: "Confirm purchase order and record inbound expectation",
        params: purchaseOrderIdParamsSchema,
        body: purchaseOrderCommandBodySchema,
        response: {
          200: purchaseOrderItemSchema,
          400: invalidResponseSchema,
          401: unauthorizedResponseSchema,
          404: notFoundResponseSchema,
          409: conflictResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await request.server.purchasing.confirmPurchaseOrder.execute({
        organizationId: OrganizationId.DEFAULT,
        staffUserId: staffUserId(request),
        purchaseOrderId: PurchaseOrderId.parse(request.params.id),
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
        return sendInvalid(reply);
      }
      return mapPurchaseOrder(result.purchaseOrder);
    },
  );

  routes.post(
    "/purchase-orders/:id/receive",
    {
      schema: {
        operationId: "receiveInternalPurchaseOrder",
        tags: ["internal"],
        summary: "Receive goods against a confirmed purchase order",
        params: purchaseOrderIdParamsSchema,
        body: purchaseOrderReceiveBodySchema,
        response: {
          200: purchaseOrderItemSchema,
          400: z.union([invalidResponseSchema, zodValidationErrorResponseSchema]),
          401: unauthorizedResponseSchema,
          404: notFoundResponseSchema,
          409: conflictResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await request.server.purchasing.receivePurchaseOrder.execute({
        organizationId: OrganizationId.DEFAULT,
        staffUserId: staffUserId(request),
        purchaseOrderId: PurchaseOrderId.parse(request.params.id),
        idempotencyKey: request.body.idempotencyKey,
        lines: request.body.lines.map((line) => ({
          lineId: PurchaseOrderLineId.parse(line.lineId),
          quantity: line.quantity,
        })),
      });
      if (!result.ok) {
        if (result.reason === "not_found" || result.reason === "line_not_found") {
          return sendNotFound(reply);
        }
        if (
          result.reason === "illegal_transition" ||
          result.reason === "over_receive" ||
          result.reason === "idempotency_conflict" ||
          result.reason === "inventory_conflict"
        ) {
          return sendConflict(reply);
        }
        return sendInvalid(reply);
      }
      return mapPurchaseOrder(result.purchaseOrder);
    },
  );

  routes.post(
    "/purchase-orders/:id/cancel",
    {
      schema: {
        operationId: "cancelInternalPurchaseOrder",
        tags: ["internal"],
        summary: "Cancel draft or confirmed unreceived purchase order remainder",
        params: purchaseOrderIdParamsSchema,
        body: purchaseOrderCommandBodySchema,
        response: {
          200: purchaseOrderItemSchema,
          401: unauthorizedResponseSchema,
          404: notFoundResponseSchema,
          409: conflictResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await request.server.purchasing.cancelPurchaseOrder.execute({
        organizationId: OrganizationId.DEFAULT,
        staffUserId: staffUserId(request),
        purchaseOrderId: PurchaseOrderId.parse(request.params.id),
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
      return mapPurchaseOrder(result.purchaseOrder);
    },
  );
}
