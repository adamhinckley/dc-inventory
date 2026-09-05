import type { FastifyInstance, FastifyReply } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { SalesOrder } from "@dc-inventory/sales";
import { z } from "zod";
import {
  CustomerId,
  OrderId,
  StaffUserId,
  WholesaleUserId,
} from "@dc-inventory/shared-kernel";
import { mapSalesOrder } from "./map-sales-order.js";
import {
  conflictResponseSchema,
  insufficientAtpResponseSchema,
  invalidResponseSchema,
  needsCustomerResponseSchema,
  notFoundResponseSchema,
  salesOrderConfirmBodySchema,
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

function lookupProductId(
  request: { server: FastifyInstance; wholesaleAuth?: WholesaleAuth },
): (sku: string) => Promise<string | null> {
  const organizationId = wholesaleOrganizationId(request);
  return (sku) => request.server.catalog.lookupProductIdBySku(organizationId, sku);
}

function lookupCustomerName(
  request: { server: FastifyInstance; wholesaleAuth?: WholesaleAuth },
): (customerId: string) => Promise<string | null> {
  const organizationId = wholesaleOrganizationId(request);
  const cache = new Map<string, Promise<string | null>>();
  return (customerId) => {
    const cached = cache.get(customerId);
    if (cached !== undefined) {
      return cached;
    }
    const pending = request.server.customers.getCustomer
      .execute({
        organizationId,
        staffUserId: wholesaleStaffUserId(request),
        customerId: CustomerId.parse(customerId),
      })
      .then((result) => (result.ok ? result.customer.name : null));
    cache.set(customerId, pending);
    return pending;
  };
}

function toSalesOrderBody(
  request: { server: FastifyInstance; wholesaleAuth?: WholesaleAuth },
  order: SalesOrder,
) {
  return mapSalesOrder(order, lookupProductId(request), lookupCustomerName(request));
}

function sendNotFound(reply: FastifyReply) {
  return reply.code(404).send({ error: "not_found" as const });
}

function sendInsufficientAtp(reply: FastifyReply) {
  return reply.code(409).send({ error: "insufficient_atp" as const });
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
        items: await Promise.all(
          result.items.map((order) => toSalesOrderBody(request, order)),
        ),
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
      return toSalesOrderBody(request, result.salesOrder);
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
      return reply.code(201).send(
        await toSalesOrderBody(request, result.salesOrder),
      );
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
      return toSalesOrderBody(request, result.salesOrder);
    },
  );

  routes.post(
    "/sales-orders/:id/confirm",
    {
      schema: {
        operationId: "confirmWholesaleSalesOrder",
        tags: ["wholesale"],
        summary: "Confirm draft sales order for session customer",
        params: salesOrderIdParamsSchema,
        body: salesOrderConfirmBodySchema,
        response: {
          200: salesOrderItemSchema,
          400: invalidResponseSchema,
          401: unauthorizedResponseSchema,
          403: needsCustomerResponseSchema,
          404: notFoundResponseSchema,
          409: z.union([conflictResponseSchema, insufficientAtpResponseSchema]),
        },
      },
    },
    async (request, reply) => {
      const actor = wholesaleCreateInput(request);
      const result = await request.server.sales.confirmSalesOrder.execute({
        organizationId: wholesaleOrganizationId(request),
        staffUserId: wholesaleStaffUserId(request),
        customerId: actor.customerId,
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
          return sendInsufficientAtp(reply);
        }
        if (
          result.reason === "illegal_transition" ||
          result.reason === "idempotency_conflict" ||
          result.reason === "inventory_conflict" ||
          result.reason === "customer_on_hold" ||
          result.reason === "customer_inactive"
        ) {
          return reply.code(409).send({ error: "conflict" as const });
        }
        return reply.code(400).send({ error: "invalid" as const });
      }
      return toSalesOrderBody(request, result.salesOrder);
    },
  );
}
