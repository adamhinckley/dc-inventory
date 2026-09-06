import type { FastifyInstance, FastifyReply, FastifySchema } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { PurchaseOrder } from "@dc-inventory/purchasing";
import { Sku, StaffUserId, SupplierId } from "@dc-inventory/shared-kernel";
import {
  draftUncoveredPurchaseOrdersBodySchema,
  draftUncoveredPurchaseOrdersResponseSchema,
  featureDisabledResponseSchema,
  invalidResponseSchema,
  inventoryStockParamsSchema,
  inventoryStockSnapshotSchema,
  reopenInventorySkusBodySchema,
  reopenInventorySkusResponseSchema,
  unauthorizedResponseSchema,
  uncoveredSkusListQuerySchema,
  uncoveredSkusListResponseSchema,
  uncoveredSkusListTable,
  uncoveredFactoriesListResponseSchema,
  uncoveredFactoriesListTable,
  uncoveredFactoriesListQuerySchema,
  zodValidationErrorResponseSchema,
} from "../../schemas.js";
import { staffOrganizationId } from "./org-session.js";

function typed(app: FastifyInstance) {
  return app.withTypeProvider<ZodTypeProvider>();
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

function sendInvalid(reply: FastifyReply) {
  return reply.code(400).send({ error: "invalid" as const });
}

function parseWindowInstant(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  return new Date(value);
}

export function registerInternalInventoryRoutes(app: FastifyInstance): void {
  const routes = typed(app);

  routes.get(
    "/inventory/stock/:sku",
    {
      schema: {
        operationId: "getInternalInventoryStock",
        tags: ["internal"],
        summary: "Read stock snapshot for a SKU",
        params: inventoryStockParamsSchema,
        response: {
          200: inventoryStockSnapshotSchema,
          401: unauthorizedResponseSchema,
          403: featureDisabledResponseSchema,
        },
      },
    },
    async (request) => {
      const { sku } = request.params as { sku: string };
      const figures = await request.server.inventory.getStockSnapshot.execute({
        organizationId: staffOrganizationId(request),
        sku: Sku.parse(sku),
      });
      return {
        sku,
        onHand: figures.onHand,
        onOrder: figures.onOrder,
        allocated: figures.allocated,
        available: figures.available,
      };
    },
  );

  routes.post(
    "/inventory/reopen-skus",
    {
      schema: {
        operationId: "reopenInternalInventorySkus",
        tags: ["internal"],
        summary: "Reopen filtered SKUs for the next pre-sell with an optional shared sell window",
        body: reopenInventorySkusBodySchema,
        response: {
          200: reopenInventorySkusResponseSchema,
          400: invalidResponseSchema,
          401: unauthorizedResponseSchema,
          403: featureDisabledResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const body = request.body as {
        skus: string[];
        windowOpensAt?: string | null;
        windowClosesAt?: string | null;
      };
      const result = await request.server.inventory.reopenSkusForPresell.execute({
        organizationId: staffOrganizationId(request),
        skus: body.skus.map((sku) => Sku.parse(sku)),
        windowOpensAt: parseWindowInstant(body.windowOpensAt),
        windowClosesAt: parseWindowInstant(body.windowClosesAt),
      });
      if (!result.ok) {
        return sendInvalid(reply);
      }
      return reply.code(200).send({ reopenedCount: body.skus.length });
    },
  );
}

export function registerInternalUncoveredSkusListRoutes(app: FastifyInstance): void {
  const routes = typed(app);

  routes.get(
    "/uncovered-skus",
    {
      schema: {
        operationId: "listInternalUncoveredSkus",
        tags: ["internal"],
        summary: "List SKUs with factory to-order need",
        querystring: uncoveredSkusListQuerySchema,
        response: {
          200: uncoveredSkusListResponseSchema,
          400: zodValidationErrorResponseSchema,
          401: unauthorizedResponseSchema,
          403: featureDisabledResponseSchema,
        },
        "x-table": uncoveredSkusListTable,
      } as FastifySchema & { "x-table": typeof uncoveredSkusListTable },
    },
    async (request) => {
      const query = request.query as {
        page: number;
        pageSize: number;
        supplierId?: string;
        needsMapping?: boolean;
      };
      const result = await request.server.inventory.listUncoveredSkus.execute({
        organizationId: staffOrganizationId(request),
        page: query.page,
        pageSize: query.pageSize,
        supplierId:
          query.supplierId === undefined ? undefined : SupplierId.parse(query.supplierId),
        needsMapping: query.needsMapping,
      });
      return {
        items: result.items.map((row) => ({
          sku: row.sku.value,
          uncovered: row.uncovered,
          onHand: row.onHand,
          onOrder: row.onOrder,
          committed: row.committed,
          caseQty: row.caseQty,
          reorderMin: row.reorderMin,
          reorderMax: row.reorderMax,
          supplierId: row.supplierId,
          supplierNumber: row.supplierNumber,
          supplierName: row.supplierName,
          mappingStatus: row.mappingStatus,
          draftPurchaseOrder: row.draftPurchaseOrder,
        })),
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
      };
    },
  );

  routes.get(
    "/uncovered-skus/factories",
    {
      schema: {
        operationId: "listInternalUncoveredFactories",
        tags: ["internal"],
        summary: "List uncovered demand grouped by factory",
        querystring: uncoveredFactoriesListQuerySchema,
        response: {
          200: uncoveredFactoriesListResponseSchema,
          400: zodValidationErrorResponseSchema,
          401: unauthorizedResponseSchema,
          403: featureDisabledResponseSchema,
        },
        "x-table": uncoveredFactoriesListTable,
      } as FastifySchema & { "x-table": typeof uncoveredFactoriesListTable },
    },
    async (request) => {
      const query = request.query as { page: number; pageSize: number };
      const result = await request.server.inventory.listUncoveredFactories.execute({
        organizationId: staffOrganizationId(request),
      });
      const total = result.items.length;
      const offset = (query.page - 1) * query.pageSize;
      const items = result.items.slice(offset, offset + query.pageSize);
      return {
        items: items.map((row) => ({
          id: row.id,
          supplierId: row.supplierId,
          supplierNumber: row.supplierNumber,
          supplierName: row.supplierName,
          productCount: row.productCount,
          totalUncoveredUnits: row.totalUncoveredUnits,
          needsMapping: row.needsMapping,
        })),
        page: query.page,
        pageSize: query.pageSize,
        total,
      };
    },
  );
}

export function registerInternalUncoveredSkusDraftPurchaseOrderRoutes(
  app: FastifyInstance,
): void {
  const routes = typed(app);

  routes.post(
    "/uncovered-skus/draft-purchase-orders",
    {
      schema: {
        operationId: "draftInternalUncoveredPurchaseOrders",
        tags: ["internal"],
        summary: "Create draft purchase orders from uncovered SKU selection",
        body: draftUncoveredPurchaseOrdersBodySchema,
        response: {
          201: draftUncoveredPurchaseOrdersResponseSchema,
          400: invalidResponseSchema,
          401: unauthorizedResponseSchema,
          403: featureDisabledResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const body = request.body as { skus: string[] };
      const result = await request.server.purchasing.draftPurchaseOrdersFromUncoveredSkus.execute({
        organizationId: staffOrganizationId(request),
        staffUserId: StaffUserId.parse(request.staffAuth?.staffUserId ?? ""),
        skus: body.skus,
      });
      if (!result.ok) {
        return sendInvalid(reply);
      }
      return reply.code(201).send({
        purchaseOrders: result.purchaseOrders.map(mapPurchaseOrder),
        unmappedSkus: [...result.unmappedSkus],
      });
    },
  );
}
