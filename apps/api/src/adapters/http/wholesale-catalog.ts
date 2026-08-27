import type { FastifyInstance, FastifyReply } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { Product, ProductQty } from "@dc-inventory/catalog";
import { CustomerId, ProductId } from "@dc-inventory/shared-kernel";
import {
  catalogListResponseSchema,
  catalogQuerySchema,
  catalogItemSchema,
  notFoundResponseSchema,
  productIdParamsSchema,
  unauthorizedResponseSchema,
} from "../../schemas.js";
import { wholesaleOrganizationId } from "./org-session.js";

function typed(app: FastifyInstance) {
  return app.withTypeProvider<ZodTypeProvider>();
}

function customerId(request: { wholesaleAuth?: { customerId: string } }): CustomerId {
  return CustomerId.parse(request.wholesaleAuth?.customerId ?? "");
}

function mapCatalogItem(product: Product, qty: ProductQty) {
  return {
    id: product.id,
    name: product.name,
    imageUrl: null,
    wholesalePrice: product.memberPrice.amountMinor,
    currency: product.memberPrice.currency,
    available: qty.available,
  };
}

function sendNotFound(reply: FastifyReply) {
  return reply.code(404).send({ error: "not_found" as const });
}

export function registerWholesaleCatalogRoutes(app: FastifyInstance): void {
  const routes = typed(app);

  routes.get(
    "/catalog",
    {
      schema: {
        operationId: "listWholesaleCatalog",
        tags: ["wholesale"],
        summary: "List shop-visible catalog products",
        querystring: catalogQuerySchema,
        response: { 200: catalogListResponseSchema, 401: unauthorizedResponseSchema },
      },
    },
    async (request) => {
      void request.query.category;
      const result = await request.server.catalog.listWholesaleCatalog.execute({
        organizationId: wholesaleOrganizationId(request),
        customerId: customerId(request),
        q: request.query.q,
        page: request.query.page,
        pageSize: request.query.pageSize,
        sortBy: request.query.sortBy,
        sortOrder: request.query.sortOrder,
      });
      return {
        items: result.items.map((row) => mapCatalogItem(row.product, row.qty)),
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
      };
    },
  );

  routes.get(
    "/catalog/:id",
    {
      schema: {
        operationId: "getWholesaleCatalogProduct",
        tags: ["wholesale"],
        summary: "Get a shop-visible catalog product (hidden is 404)",
        params: productIdParamsSchema,
        response: {
          200: catalogItemSchema,
          401: unauthorizedResponseSchema,
          404: notFoundResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await request.server.catalog.getWholesaleProduct.execute({
        organizationId: wholesaleOrganizationId(request),
        customerId: customerId(request),
        productId: ProductId.parse(request.params.id),
      });
      if (!result.ok) {
        return sendNotFound(reply);
      }
      return mapCatalogItem(result.product, result.qty);
    },
  );
}
