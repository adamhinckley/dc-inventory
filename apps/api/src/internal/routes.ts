import type { FastifyInstance } from "fastify";
import type { FastifySchema } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import {
  emptyProductList,
  listQuerySchema,
  productListResponseSchema,
  productsListTable,
} from "../schemas.js";

function typed(app: FastifyInstance) {
  return app.withTypeProvider<ZodTypeProvider>();
}

/** Staff mount (`/internal`). Stubs from ADA-35; business routes come later. */
export async function internalRoutes(app: FastifyInstance): Promise<void> {
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
