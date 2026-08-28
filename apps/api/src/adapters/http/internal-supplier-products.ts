import type { FastifyInstance, FastifyReply } from "fastify";
import type { FastifySchema } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { SupplierProductId, type SupplierProduct } from "@dc-inventory/purchasing";
import { StaffUserId, SupplierId } from "@dc-inventory/shared-kernel";
import { z } from "zod";
import {
  duplicateSkuResponseSchema,
  invalidResponseSchema,
  notFoundResponseSchema,
  supplierIdParamsSchema,
  supplierProductListQuerySchema,
  supplierProductListResponseSchema,
  supplierProductParamsSchema,
  supplierProductPatchBodySchema,
  supplierProductWriteBodySchema,
  supplierProductWriteItemSchema,
  supplierProductsListTable,
  unauthorizedResponseSchema,
  unknownSkuResponseSchema,
} from "../../schemas.js";
import { staffOrganizationId } from "./org-session.js";

function typed(app: FastifyInstance) {
  return app.withTypeProvider<ZodTypeProvider>();
}

function staffUserId(request: { staffAuth?: { staffUserId: string } }): StaffUserId {
  return StaffUserId.parse(request.staffAuth?.staffUserId ?? "");
}

function mapSupplierProduct(product: SupplierProduct) {
  return {
    id: product.id,
    sku: product.sku.value,
    supplierSku: product.supplierSku,
    minOrderQty: product.minOrderQty,
    minOrderAmountCents: product.minOrderAmountCents,
    lastPoCostCents: product.lastPoCostCents,
    currency: product.currency,
  };
}

function sendNotFound(reply: FastifyReply) {
  return reply.code(404).send({ error: "not_found" as const });
}

function sendInvalid(reply: FastifyReply) {
  return reply.code(400).send({ error: "invalid" as const });
}

function sendDuplicateSku(reply: FastifyReply) {
  return reply.code(409).send({ error: "duplicate_sku" as const });
}

function sendUnknownSku(reply: FastifyReply) {
  return reply.code(400).send({ error: "unknown_sku" as const });
}

const errorResponses = {
  401: unauthorizedResponseSchema,
  404: notFoundResponseSchema,
  400: invalidResponseSchema,
};

export function registerInternalSupplierProductRoutes(app: FastifyInstance): void {
  const routes = typed(app);

  routes.get(
    "/suppliers/:id/products",
    {
      schema: {
        operationId: "listInternalSupplierProducts",
        tags: ["internal-suppliers"],
        summary: "List vendor SKUs for a supplier",
        params: supplierIdParamsSchema,
        querystring: supplierProductListQuerySchema,
        response: { 200: supplierProductListResponseSchema, ...errorResponses },
        "x-table": supplierProductsListTable,
      } as FastifySchema & { "x-table": typeof supplierProductsListTable },
    },
    async (request, reply) => {
      const query = request.query as { page: number; pageSize: number };
      const params = request.params as { id: string };
      const result = await request.server.purchasing.listSupplierProducts.execute({
        organizationId: staffOrganizationId(request),
        staffUserId: staffUserId(request),
        supplierId: SupplierId.parse(params.id),
        page: query.page,
        pageSize: query.pageSize,
      });
      if (!result.ok) {
        return sendNotFound(reply);
      }
      return {
        items: result.items,
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
      };
    },
  );

  routes.post(
    "/suppliers/:id/products",
    {
      schema: {
        operationId: "assignInternalSupplierProduct",
        tags: ["internal-suppliers"],
        summary: "Assign a catalog SKU to a supplier",
        params: supplierIdParamsSchema,
        body: supplierProductWriteBodySchema,
        response: {
          201: supplierProductWriteItemSchema,
          400: z.union([invalidResponseSchema, unknownSkuResponseSchema]),
          401: unauthorizedResponseSchema,
          404: notFoundResponseSchema,
          409: duplicateSkuResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { id: string };
      const result = await request.server.purchasing.assignSupplierProduct.execute({
        organizationId: staffOrganizationId(request),
        staffUserId: staffUserId(request),
        supplierId: SupplierId.parse(params.id),
        sku: request.body.sku,
        supplierSku: request.body.supplierSku,
        minOrderQty: request.body.minOrderQty,
        minOrderAmountCents: request.body.minOrderAmountCents,
        lastPoCostCents: request.body.lastPoCostCents,
        currency: request.body.currency,
      });
      if (!result.ok) {
        if (result.reason === "not_found") {
          return sendNotFound(reply);
        }
        if (result.reason === "duplicate_sku") {
          return sendDuplicateSku(reply);
        }
        if (result.reason === "unknown_sku") {
          return sendUnknownSku(reply);
        }
        return sendInvalid(reply);
      }
      return reply.code(201).send(mapSupplierProduct(result.product));
    },
  );

  routes.patch(
    "/suppliers/:id/products/:productId",
    {
      schema: {
        operationId: "updateInternalSupplierProduct",
        tags: ["internal-suppliers"],
        summary: "Update vendor SKU terms",
        params: supplierProductParamsSchema,
        body: supplierProductPatchBodySchema,
        response: {
          200: supplierProductWriteItemSchema,
          ...errorResponses,
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { id: string; productId: string };
      const result = await request.server.purchasing.updateSupplierProduct.execute({
        organizationId: staffOrganizationId(request),
        staffUserId: staffUserId(request),
        supplierId: SupplierId.parse(params.id),
        productId: SupplierProductId.parse(params.productId),
        supplierSku: request.body.supplierSku,
        minOrderQty: request.body.minOrderQty,
        minOrderAmountCents: request.body.minOrderAmountCents,
        lastPoCostCents: request.body.lastPoCostCents,
        currency: request.body.currency,
      });
      if (!result.ok) {
        return result.reason === "not_found" ? sendNotFound(reply) : sendInvalid(reply);
      }
      return mapSupplierProduct(result.product);
    },
  );

  routes.delete(
    "/suppliers/:id/products/:productId",
    {
      schema: {
        operationId: "unlinkInternalSupplierProduct",
        tags: ["internal-suppliers"],
        summary: "Unlink a catalog SKU from a supplier",
        params: supplierProductParamsSchema,
        response: {
          204: z.null(),
          ...errorResponses,
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { id: string; productId: string };
      const result = await request.server.purchasing.unlinkSupplierProduct.execute({
        organizationId: staffOrganizationId(request),
        staffUserId: staffUserId(request),
        supplierId: SupplierId.parse(params.id),
        productId: SupplierProductId.parse(params.productId),
      });
      if (!result.ok) {
        return sendNotFound(reply);
      }
      return reply.code(204).send(null);
    },
  );
}
