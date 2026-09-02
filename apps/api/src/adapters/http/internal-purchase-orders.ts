import type { FastifyInstance, FastifyReply } from "fastify";
import type { FastifySchema } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { PurchaseOrderLineId, type PurchaseOrder } from "@dc-inventory/purchasing";
import { PurchaseOrderId, StaffUserId, SupplierId } from "@dc-inventory/shared-kernel";
import {
  conflictResponseSchema,
  invalidResponseSchema,
  notFoundResponseSchema,
  purchaseOrderCommandBodySchema,
  purchaseOrderIdParamsSchema,
  purchaseOrderExportQuerySchema,
  purchaseOrderFactorySendResponseSchema,
  binaryFileResponseSchema,
  purchaseOrderItemSchema,
  purchaseOrderListQuerySchema,
  purchaseOrderListResponseSchema,
  purchaseOrderReceiveBodySchema,
  purchaseOrderReplaceLinesBodySchema,
  purchaseOrderWriteBodySchema,
  purchaseOrdersListTable,
  unauthorizedResponseSchema,
  zodValidationErrorResponseSchema,
} from "../../schemas.js";
import { staffOrganizationId } from "./org-session.js";

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
    shipDate: order.shipDate,
    cancelDate: order.cancelDate,
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
          400: zodValidationErrorResponseSchema,
          401: unauthorizedResponseSchema,
        },
        "x-table": purchaseOrdersListTable,
      } as FastifySchema & { "x-table": typeof purchaseOrdersListTable },
    },
    async (request) => {
      const query = request.query as {
        q?: string;
        page: number;
        pageSize: number;
        sortBy: "documentNumber" | "status";
        sortOrder: "asc" | "desc";
        status?: PurchaseOrder["status"];
        supplierId?: string;
      };
      const result = await request.server.purchasing.listPurchaseOrders.execute({
        organizationId: staffOrganizationId(request),
        staffUserId: staffUserId(request),
        q: query.q,
        page: query.page,
        pageSize: query.pageSize,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
        status: query.status,
        supplierId:
          query.supplierId === undefined ? undefined : SupplierId.parse(query.supplierId),
      });
      return {
        items: result.items.map((order) => ({
          ...mapPurchaseOrder(order),
          supplierName: result.supplierNames.get(order.supplierId) ?? "",
        })),
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
        organizationId: staffOrganizationId(request),
        staffUserId: staffUserId(request),
        supplierId: SupplierId.parse(request.body.supplierId),
        shipDate: request.body.shipDate,
        cancelDate: request.body.cancelDate,
        lines: request.body.lines,
      });
      if (!result.ok) {
        if (
          result.reason === "supplier_not_found" ||
          result.reason === "product_not_found"
        ) {
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

  routes.patch(
    "/purchase-orders/:id",
    {
      schema: {
        operationId: "replaceInternalPurchaseOrderLines",
        tags: ["internal"],
        summary: "Replace lines on a draft purchase order",
        params: purchaseOrderIdParamsSchema,
        body: purchaseOrderReplaceLinesBodySchema,
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
      const result = await request.server.purchasing.replacePurchaseOrderLines.execute({
        organizationId: staffOrganizationId(request),
        staffUserId: staffUserId(request),
        purchaseOrderId: PurchaseOrderId.parse(request.params.id),
        shipDate: request.body.shipDate,
        cancelDate: request.body.cancelDate,
        lines: request.body.lines,
      });
      if (!result.ok) {
        if (result.reason === "not_found" || result.reason === "product_not_found") {
          return sendNotFound(reply);
        }
        if (result.reason === "illegal_transition") {
          return sendConflict(reply);
        }
        if (result.reason === "empty_order") {
          return sendInvalid(reply);
        }
        return sendInvalid(reply);
      }
      return mapPurchaseOrder(result.purchaseOrder);
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
        organizationId: staffOrganizationId(request),
        staffUserId: staffUserId(request),
        purchaseOrderId: PurchaseOrderId.parse(request.params.id),
      });
      if (!result.ok) {
        return sendNotFound(reply);
      }
      return mapPurchaseOrder(result.purchaseOrder);
    },
  );

  routes.get(
    "/purchase-orders/:id/export",
    {
      schema: {
        operationId: "exportInternalPurchaseOrder",
        tags: ["internal"],
        summary: "Export purchase order lines as spreadsheet",
        params: purchaseOrderIdParamsSchema,
        querystring: purchaseOrderExportQuerySchema,
        response: {
          200: binaryFileResponseSchema,
          401: unauthorizedResponseSchema,
          404: notFoundResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const query = request.query as { format: "xlsx" | "csv" };
      const result = await request.server.purchasing.exportPurchaseOrder.execute({
        organizationId: staffOrganizationId(request),
        staffUserId: staffUserId(request),
        purchaseOrderId: PurchaseOrderId.parse(request.params.id),
        format: query.format,
      });
      if (!result.ok) {
        return sendNotFound(reply);
      }
      return reply
        .code(200)
        .header("Content-Type", result.file.contentType)
        .header("Content-Disposition", `attachment; filename="${result.file.filename}"`)
        .send(Buffer.from(result.file.bytes));
    },
  );

  routes.get(
    "/purchase-orders/:id/factory-send",
    {
      schema: {
        operationId: "getInternalPurchaseOrderFactorySend",
        tags: ["internal"],
        summary: "Return factory-send columns and rows for a purchase order",
        params: purchaseOrderIdParamsSchema,
        response: {
          200: purchaseOrderFactorySendResponseSchema,
          401: unauthorizedResponseSchema,
          404: notFoundResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await request.server.purchasing.getPurchaseOrderFactorySend.execute({
        organizationId: staffOrganizationId(request),
        staffUserId: staffUserId(request),
        purchaseOrderId: PurchaseOrderId.parse(request.params.id),
      });
      if (!result.ok) {
        return sendNotFound(reply);
      }
      return purchaseOrderFactorySendResponseSchema.parse({
        columns: [...result.columns],
        rows: [...result.rows],
      });
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
        organizationId: staffOrganizationId(request),
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
          result.reason === "product_not_found" ||
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
        organizationId: staffOrganizationId(request),
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
    "/purchase-orders/:id/cancel-remaining",
    {
      schema: {
        operationId: "cancelRemainingInternalPurchaseOrder",
        tags: ["internal"],
        summary: "Close leftover inbound on a partially received purchase order",
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
      const result = await request.server.purchasing.cancelRemainingPurchaseOrder.execute({
        organizationId: staffOrganizationId(request),
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
        organizationId: staffOrganizationId(request),
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
