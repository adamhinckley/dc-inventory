import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { FastifySchema } from "fastify";
import {
  catalogListResponseSchema,
  catalogQuerySchema,
  emptyCatalogList,
  emptyProductList,
  listQuerySchema,
  opsSubscriptionSchema,
  productListResponseSchema,
  productsListTable,
  stubOpsSubscription,
} from "./schemas.js";

function typed(app: FastifyInstance) {
  return app.withTypeProvider<ZodTypeProvider>();
}

export function registerInternalRoutes(app: FastifyInstance): void {
  typed(app).route({
    method: "GET",
    url: "/internal/products",
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

export function registerWholesaleRoutes(app: FastifyInstance): void {
  typed(app).route({
    method: "GET",
    url: "/wholesale/catalog",
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

export function registerOpsRoutes(app: FastifyInstance): void {
  typed(app).route({
    method: "GET",
    url: "/ops/subscription",
    schema: {
      operationId: "getOpsSubscription",
      tags: ["ops"],
      summary: "Stub software subscription",
      response: { 200: opsSubscriptionSchema },
    },
    handler: async () => stubOpsSubscription,
  });
}
