import type { FastifyInstance, FastifySchema } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { Sku } from "@dc-inventory/shared-kernel";
import {
  featureDisabledResponseSchema,
  inventoryStockParamsSchema,
  inventoryStockSnapshotSchema,
  unauthorizedResponseSchema,
  uncoveredSkusListQuerySchema,
  uncoveredSkusListResponseSchema,
  uncoveredSkusListTable,
  zodValidationErrorResponseSchema,
} from "../../schemas.js";
import { staffOrganizationId } from "./org-session.js";

function typed(app: FastifyInstance) {
  return app.withTypeProvider<ZodTypeProvider>();
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
}

export function registerInternalUncoveredSkusRoutes(app: FastifyInstance): void {
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
      const query = request.query as { page: number; pageSize: number };
      const result = await request.server.inventory.listUncoveredSkus.execute({
        organizationId: staffOrganizationId(request),
        page: query.page,
        pageSize: query.pageSize,
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
        })),
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
      };
    },
  );
}
