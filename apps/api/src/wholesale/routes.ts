import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import {
  catalogListResponseSchema,
  catalogQuerySchema,
  emptyCatalogList,
} from "../schemas.js";

function typed(app: FastifyInstance) {
  return app.withTypeProvider<ZodTypeProvider>();
}

/** Wholesale-client mount (`/wholesale`). */
export async function wholesaleRoutes(app: FastifyInstance): Promise<void> {
  typed(app).route({
    method: "GET",
    url: "/catalog",
    schema: {
      operationId: "listWholesaleCatalog",
      tags: ["wholesale"],
      summary: "Stub catalog list for product-card examples",
      querystring: catalogQuerySchema,
      response: { 200: catalogListResponseSchema },
    },
    handler: async () => emptyCatalogList,
  });
}
