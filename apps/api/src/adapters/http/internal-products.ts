import type { FastifyInstance, FastifyReply } from "fastify";
import type { FastifySchema } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { Product, ProductQty } from "@dc-inventory/catalog";
import { CsvWorkbookParser } from "@dc-inventory/catalog";
import { ProductId, StaffUserId } from "@dc-inventory/shared-kernel";
import {
  duplicateSkuResponseSchema,
  invalidResponseSchema,
  listQuerySchema,
  notFoundResponseSchema,
  productDetailSchema,
  productIdParamsSchema,
  productImportQuerySchema,
  productImportResultSchema,
  productListResponseSchema,
  productPatchBodySchema,
  productWriteBodySchema,
  productsListTable,
  qtyNotAllowedResponseSchema,
  skuImmutableResponseSchema,
  SPREADSHEET_UPLOAD_MAX_BYTES,
  unauthorizedResponseSchema,
} from "../../schemas.js";
import { staffOrganizationId } from "./org-session.js";

function typed(app: FastifyInstance) {
  return app.withTypeProvider<ZodTypeProvider>();
}

function staffUserId(request: { staffAuth?: { staffUserId: string } }): StaffUserId {
  return StaffUserId.parse(request.staffAuth?.staffUserId ?? "");
}

function mapQty(qty: ProductQty) {
  return {
    onHand: qty.onHand,
    onOrder: qty.onOrder,
    allocated: qty.allocated,
    available: qty.available,
  };
}

function mapListItem(product: Product, qty: ProductQty, createdAt: Date) {
  return {
    id: product.id,
    sku: product.sku.value,
    name: product.name,
    memberPrice: product.memberPrice.amountMinor,
    currency: product.memberPrice.currency,
    inactive: product.inactive,
    discontinued: product.discontinued,
    webWholesale: product.webWholesale,
    ...mapQty(qty),
    createdAt: createdAt.toISOString(),
  };
}

function mapDetail(product: Product, qty: ProductQty) {
  return {
    id: product.id,
    sku: product.sku.value,
    name: product.name,
    description: product.description,
    uom: product.uom,
    memberPriceCents: product.memberPrice.amountMinor,
    currency: product.memberPrice.currency,
    inactive: product.inactive,
    discontinued: product.discontinued,
    webWholesale: product.webWholesale,
    taxCategoryCode: product.taxCategoryCode,
    ...mapQty(qty),
  };
}

function sendNotFound(reply: FastifyReply) {
  return reply.code(404).send({ error: "not_found" as const });
}

function sendInvalid(reply: FastifyReply) {
  return reply.code(400).send({ error: "invalid" as const });
}

const writeErrorResponses = {
  400: invalidResponseSchema,
  401: unauthorizedResponseSchema,
  404: notFoundResponseSchema,
  409: duplicateSkuResponseSchema,
};

export function registerInternalProductRoutes(app: FastifyInstance): void {
  const routes = typed(app);

  routes.get(
    "/products",
    {
      schema: {
        operationId: "listInternalProducts",
        tags: ["internal"],
        summary: "List products including shop-hidden SKUs",
        querystring: listQuerySchema,
        response: { 200: productListResponseSchema, 401: unauthorizedResponseSchema },
        "x-table": productsListTable,
      } as FastifySchema & { "x-table": typeof productsListTable },
    },
    async (request) => {
      const query = request.query as {
        q?: string;
        page: number;
        pageSize: number;
        sortBy: "sku" | "name" | "onHand" | "available" | "createdAt";
        sortOrder: "asc" | "desc";
        inactive?: boolean;
      };
      const result = await request.server.catalog.listStaffProducts.execute({
        organizationId: staffOrganizationId(request),
        staffUserId: staffUserId(request),
        q: query.q,
        page: query.page,
        pageSize: query.pageSize,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
        inactive: query.inactive,
      });
      return {
        items: result.items.map((row) =>
          mapListItem(row.product, row.qty, row.createdAt),
        ),
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
      };
    },
  );

  routes.post(
    "/products/import",
    {
      schema: {
        operationId: "importInternalProducts",
        tags: ["internal"],
        summary: "Import Product Browser CSV into catalog and vendors",
        querystring: productImportQuerySchema,
        response: {
          200: productImportResultSchema,
          400: invalidResponseSchema,
          401: unauthorizedResponseSchema,
        },
      },
    },
    async (request, reply) => {
      let file: Awaited<ReturnType<typeof request.file>>;
      try {
        file = await request.file();
      } catch {
        return sendInvalid(reply);
      }
      if (file === undefined) {
        return sendInvalid(reply);
      }
      const filename = file.filename.toLowerCase();
      const csvLike =
        filename.endsWith(".csv") ||
        file.mimetype === "text/csv" ||
        file.mimetype === "application/vnd.ms-excel" ||
        file.mimetype === "application/octet-stream" ||
        file.mimetype === "text/plain";
      if (!csvLike) {
        return sendInvalid(reply);
      }
      let bytes: Uint8Array;
      try {
        bytes = await file.toBuffer();
      } catch {
        return sendInvalid(reply);
      }
      if (bytes.byteLength > SPREADSHEET_UPLOAD_MAX_BYTES) {
        return sendInvalid(reply);
      }
      const rows = await new CsvWorkbookParser().parse({
        bytes,
        filename: file.filename,
        contentType: file.mimetype,
      });
      const query = request.query as { dryRun?: boolean };
      return request.server.catalog.importProductBrowser.execute({
        organizationId: staffOrganizationId(request),
        staffUserId: staffUserId(request),
        rows,
        dryRun: query.dryRun === true,
      });
    },
  );

  routes.post(
    "/products",
    {
      schema: {
        operationId: "createInternalProduct",
        tags: ["internal"],
        summary: "Create product",
        body: productWriteBodySchema,
        response: {
          201: productDetailSchema,
          400: invalidResponseSchema,
          401: unauthorizedResponseSchema,
          409: duplicateSkuResponseSchema,
          422: qtyNotAllowedResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await request.server.catalog.createProduct.execute({
        ...request.body,
        organizationId: staffOrganizationId(request),
        staffUserId: staffUserId(request),
      });
      if (!result.ok) {
        if (result.reason === "duplicate_sku") {
          return reply.code(409).send({ error: "duplicate_sku" as const });
        }
        if (result.reason === "qty_not_allowed") {
          return reply.code(422).send({ error: "qty_not_allowed" as const });
        }
        return sendInvalid(reply);
      }
      return reply.code(201).send(
        mapDetail(result.product, {
          onHand: 0,
          onOrder: 0,
          allocated: 0,
          available: 0,
        }),
      );
    },
  );

  routes.get(
    "/products/:id",
    {
      schema: {
        operationId: "getInternalProduct",
        tags: ["internal"],
        summary: "Get product",
        params: productIdParamsSchema,
        response: {
          200: productDetailSchema,
          401: unauthorizedResponseSchema,
          404: notFoundResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await request.server.catalog.getProduct.execute({
        organizationId: staffOrganizationId(request),
        staffUserId: staffUserId(request),
        productId: ProductId.parse(request.params.id),
      });
      if (!result.ok) {
        return sendNotFound(reply);
      }
      return mapDetail(result.product, result.qty);
    },
  );

  routes.patch(
    "/products/:id",
    {
      schema: {
        operationId: "updateInternalProduct",
        tags: ["internal"],
        summary: "Update product (sku is immutable; no qty writes)",
        params: productIdParamsSchema,
        body: productPatchBodySchema,
        response: {
          200: productDetailSchema,
          ...writeErrorResponses,
          422: qtyNotAllowedResponseSchema,
          409: skuImmutableResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await request.server.catalog.updateProduct.execute({
        ...request.body,
        organizationId: staffOrganizationId(request),
        staffUserId: staffUserId(request),
        productId: ProductId.parse(request.params.id),
      });
      if (!result.ok) {
        if (result.reason === "not_found") {
          return sendNotFound(reply);
        }
        if (result.reason === "sku_immutable") {
          return reply.code(409).send({ error: "sku_immutable" as const });
        }
        if (result.reason === "qty_not_allowed") {
          return reply.code(422).send({ error: "qty_not_allowed" as const });
        }
        return sendInvalid(reply);
      }
      return mapDetail(result.product, result.qty);
    },
  );
}
