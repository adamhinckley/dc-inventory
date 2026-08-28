import type { FastifyInstance, FastifyReply } from "fastify";
import type { FastifySchema } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { Supplier } from "@dc-inventory/purchasing";
import { StaffUserId, SupplierId } from "@dc-inventory/shared-kernel";
import {
  duplicateVendorNumberResponseSchema,
  invalidResponseSchema,
  notFoundResponseSchema,
  supplierIdParamsSchema,
  supplierItemSchema,
  supplierListQuerySchema,
  supplierListResponseSchema,
  supplierPatchBodySchema,
  supplierWriteBodySchema,
  suppliersListTable,
  unauthorizedResponseSchema,
} from "../../schemas.js";
import { staffOrganizationId } from "./org-session.js";

function typed(app: FastifyInstance) {
  return app.withTypeProvider<ZodTypeProvider>();
}

function staffUserId(request: { staffAuth?: { staffUserId: string } }): StaffUserId {
  return StaffUserId.parse(request.staffAuth?.staffUserId ?? "");
}

function mapSupplier(supplier: Supplier) {
  return {
    id: supplier.id,
    vendorNumber: supplier.vendorNumber,
    name: supplier.name,
  };
}

function sendNotFound(reply: FastifyReply) {
  return reply.code(404).send({ error: "not_found" as const });
}

function sendInvalid(reply: FastifyReply) {
  return reply.code(400).send({ error: "invalid" as const });
}

function sendDuplicateVendorNumber(reply: FastifyReply) {
  return reply.code(409).send({ error: "duplicate_vendor_number" as const });
}

const errorResponses = {
  401: unauthorizedResponseSchema,
  404: notFoundResponseSchema,
  400: invalidResponseSchema,
};

export function registerInternalSupplierRoutes(app: FastifyInstance): void {
  const routes = typed(app);

  routes.get(
    "/suppliers",
    {
      schema: {
        operationId: "listInternalSuppliers",
        tags: ["internal-suppliers"],
        summary: "List suppliers",
        querystring: supplierListQuerySchema,
        response: { 200: supplierListResponseSchema, 401: unauthorizedResponseSchema },
        "x-table": suppliersListTable,
      } as FastifySchema & { "x-table": typeof suppliersListTable },
    },
    async (request) => {
      const query = request.query as {
        q?: string;
        page: number;
        pageSize: number;
      };
      const result = await request.server.purchasing.listSuppliers.execute({
        organizationId: staffOrganizationId(request),
        staffUserId: staffUserId(request),
        q: query.q,
        page: query.page,
        pageSize: query.pageSize,
      });
      return {
        items: result.items.map(mapSupplier),
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
      };
    },
  );

  routes.post(
    "/suppliers",
    {
      schema: {
        operationId: "createInternalSupplier",
        tags: ["internal-suppliers"],
        summary: "Create supplier",
        body: supplierWriteBodySchema,
        response: {
          201: supplierItemSchema,
          400: invalidResponseSchema,
          401: unauthorizedResponseSchema,
          409: duplicateVendorNumberResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await request.server.purchasing.createSupplier.execute({
        organizationId: staffOrganizationId(request),
        staffUserId: staffUserId(request),
        name: request.body.name,
        vendorNumber: request.body.vendorNumber,
      });
      if (!result.ok) {
        return result.reason === "duplicate_vendor_number"
          ? sendDuplicateVendorNumber(reply)
          : sendInvalid(reply);
      }
      return reply.code(201).send(mapSupplier(result.supplier));
    },
  );

  routes.get(
    "/suppliers/:id",
    {
      schema: {
        operationId: "getInternalSupplier",
        tags: ["internal-suppliers"],
        summary: "Get supplier",
        params: supplierIdParamsSchema,
        response: { 200: supplierItemSchema, ...errorResponses },
      },
    },
    async (request, reply) => {
      const result = await request.server.purchasing.getSupplier.execute({
        organizationId: staffOrganizationId(request),
        staffUserId: staffUserId(request),
        supplierId: SupplierId.parse(request.params.id),
      });
      if (!result.ok) {
        return sendNotFound(reply);
      }
      return mapSupplier(result.supplier);
    },
  );

  routes.patch(
    "/suppliers/:id",
    {
      schema: {
        operationId: "updateInternalSupplier",
        tags: ["internal-suppliers"],
        summary: "Update supplier",
        params: supplierIdParamsSchema,
        body: supplierPatchBodySchema,
        response: {
          200: supplierItemSchema,
          409: duplicateVendorNumberResponseSchema,
          ...errorResponses,
        },
      },
    },
    async (request, reply) => {
      const result = await request.server.purchasing.updateSupplier.execute({
        organizationId: staffOrganizationId(request),
        staffUserId: staffUserId(request),
        supplierId: SupplierId.parse(request.params.id),
        name: request.body.name,
        vendorNumber: request.body.vendorNumber,
      });
      if (!result.ok) {
        if (result.reason === "duplicate_vendor_number") {
          return sendDuplicateVendorNumber(reply);
        }
        return result.reason === "not_found" ? sendNotFound(reply) : sendInvalid(reply);
      }
      return mapSupplier(result.supplier);
    },
  );
}
