import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { registerWholesaleAudienceGuard } from "../adapters/http/audience-guard.js";
import { registerWholesaleAuthRoutes } from "../adapters/http/wholesale-auth.js";
import {
  catalogListResponseSchema,
  catalogQuerySchema,
  stubCatalogList,
} from "../schemas.js";

function typed(app: FastifyInstance) {
  return app.withTypeProvider<ZodTypeProvider>();
}

/** Wholesale-client mount (`/wholesale`). Auth HTTP from ADA-77; catalog remains a stub. */
export async function wholesaleRoutes(app: FastifyInstance): Promise<void> {
  registerWholesaleAuthRoutes(app);
  registerWholesaleAudienceGuard(app);
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
    handler: async () => stubCatalogList,
  });
}
