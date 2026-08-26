import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { StaffUserId } from "@dc-inventory/shared-kernel";
import {
  supplierListResponseSchema,
  unauthorizedResponseSchema,
} from "../../schemas.js";

function typed(app: FastifyInstance) {
  return app.withTypeProvider<ZodTypeProvider>();
}

function staffUserId(request: { staffAuth?: { staffUserId: string } }): StaffUserId {
  return StaffUserId.parse(request.staffAuth?.staffUserId ?? "");
}

export function registerInternalSupplierRoutes(app: FastifyInstance): void {
  const routes = typed(app);

  routes.get(
    "/suppliers",
    {
      schema: {
        operationId: "listInternalSuppliers",
        tags: ["internal"],
        summary: "List suppliers for purchase-order create",
        response: {
          200: supplierListResponseSchema,
          401: unauthorizedResponseSchema,
        },
      },
    },
    async (request) => {
      const result = await request.server.purchasing.listSuppliers.execute({
        staffUserId: staffUserId(request),
      });
      return {
        items: result.items.map((supplier) => ({
          id: supplier.id,
          vendorNumber: supplier.vendorNumber,
          name: supplier.name,
        })),
      };
    },
  );
}
