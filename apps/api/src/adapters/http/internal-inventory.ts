import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { Sku } from "@dc-inventory/shared-kernel";
import {
  featureDisabledResponseSchema,
  inventoryStockParamsSchema,
  inventoryStockSnapshotSchema,
  unauthorizedResponseSchema,
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
