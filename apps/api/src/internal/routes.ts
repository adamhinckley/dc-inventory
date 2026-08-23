import type { FastifyInstance } from "fastify";
import type { FastifySchema } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { registerStaffAudienceGuard } from "../adapters/http/audience-guard.js";
import { registerInternalAuthRoutes } from "../adapters/http/internal-auth.js";
import {
  emptyProductList,
  listQuerySchema,
  productListResponseSchema,
  productsListTable,
} from "../schemas.js";

function typed(app: FastifyInstance) {
  return app.withTypeProvider<ZodTypeProvider>();
}

/** Staff mount (`/internal`). Auth HTTP from ADA-77; product list remains a stub. */
export async function internalRoutes(app: FastifyInstance): Promise<void> {
  registerInternalAuthRoutes(app);
  registerStaffAudienceGuard(app);
  typed(app).route({
    method: "GET",
    url: "/products",
    schema: {
      operationId: "listInternalProducts",
      tags: ["internal"],
      summary: "Stub product list for DataTable (x-table)",
      querystring: listQuerySchema,
      response: { 200: productListResponseSchema },
      "x-table": productsListTable,
    } as FastifySchema & { "x-table": typeof productsListTable },
    handler: async () => emptyProductList,
  });
}
