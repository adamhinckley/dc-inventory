import type { FastifyInstance, FastifyReply } from "fastify";
import type { FastifySchema } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { OrganizationId } from "@dc-inventory/shared-kernel";
import {
  createInternalOrganizationBodySchema,
  createInternalOrganizationResponseSchema,
  deleteInternalOrganizationConflictResponseSchema,
  forbiddenResponseSchema,
  invalidResponseSchema,
  inviteFailedResponseSchema,
  licensingTwinFailedResponseSchema,
  notFoundResponseSchema,
  organizationIdParamsSchema,
  organizationListQuerySchema,
  organizationListResponseSchema,
  organizationsListTable,
  slugTakenResponseSchema,
  unauthorizedResponseSchema,
} from "../../schemas.js";

function typed(app: FastifyInstance) {
  return app.withTypeProvider<ZodTypeProvider>();
}

function sendInvalid(reply: FastifyReply) {
  return reply.code(400).send({ error: "invalid" as const });
}

function sendForbidden(reply: FastifyReply) {
  return reply.code(403).send({ error: "forbidden" as const });
}

function sendNotFound(reply: FastifyReply) {
  return reply.code(404).send({ error: "not_found" as const });
}

export function registerInternalOrganizationRoutes(app: FastifyInstance): void {
  const routes = typed(app);

  routes.get(
    "/organizations",
    {
      preHandler: async (request, reply) => {
        if (request.platformAuth === undefined) {
          return sendForbidden(reply);
        }
      },
      schema: {
        operationId: "listInternalOrganizations",
        tags: ["internal-organizations"],
        summary: "List organizations (Platform user only)",
        querystring: organizationListQuerySchema,
        response: {
          200: organizationListResponseSchema,
          401: unauthorizedResponseSchema,
          403: forbiddenResponseSchema,
        },
        "x-table": organizationsListTable,
      } as FastifySchema & { "x-table": typeof organizationsListTable },
    },
    async (request) => {
      const query = request.query as {
        q?: string;
        page: number;
        pageSize: number;
        sortBy: "name" | "slug" | "id";
        sortOrder: "asc" | "desc";
      };
      const result = await request.server.identity.listOrganizations.execute(query);
      return {
        items: result.items.map((organization) => ({
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
        })),
        page: query.page,
        pageSize: query.pageSize,
        total: result.total,
      };
    },
  );

  routes.post(
    "/organizations",
    {
      preHandler: async (request, reply) => {
        if (request.platformAuth === undefined) {
          return sendForbidden(reply);
        }
      },
      schema: {
        operationId: "createInternalOrganization",
        tags: ["internal-organizations"],
        summary: "Provision a new organization and invite its first admin (Platform user only)",
        body: createInternalOrganizationBodySchema,
        response: {
          201: createInternalOrganizationResponseSchema,
          400: invalidResponseSchema,
          401: unauthorizedResponseSchema,
          403: forbiddenResponseSchema,
          409: slugTakenResponseSchema,
          502: inviteFailedResponseSchema,
          503: licensingTwinFailedResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const result =
        await request.server.identity.registerOrganizationWithLicensing.execute(request.body);
      if (!result.ok) {
        if (result.reason === "slug_taken") {
          return reply.code(409).send({ error: "slug_taken" as const });
        }
        if (result.reason === "invite_failed") {
          return reply.code(502).send({ error: "invite_failed" as const });
        }
        if (result.reason === "licensing_twin_failed") {
          return reply.code(503).send({ error: "licensing_twin_failed" as const });
        }
        return sendInvalid(reply);
      }

      return reply.code(201).send({
        organizationId: result.organizationId,
        staffUserId: result.staffUserId,
        slug: result.slug,
        inviteSentTo: result.inviteSentTo,
      });
    },
  );

  routes.delete(
    "/organizations/:id",
    {
      preHandler: async (request, reply) => {
        if (request.platformAuth === undefined) {
          return sendForbidden(reply);
        }
      },
      schema: {
        operationId: "deleteInternalOrganization",
        tags: ["internal-organizations"],
        summary: "Delete an empty organization (Platform user only)",
        params: organizationIdParamsSchema,
        response: {
          204: z.null(),
          401: unauthorizedResponseSchema,
          403: forbiddenResponseSchema,
          404: notFoundResponseSchema,
          409: deleteInternalOrganizationConflictResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const organizationId = OrganizationId.parse(request.params.id);
      const result =
        await request.server.identity.deleteOrganizationWithOccupancy.execute(organizationId);
      if (!result.ok) {
        if (result.reason === "not_found") {
          return sendNotFound(reply);
        }
        if (result.reason === "default_organization") {
          return reply.code(409).send({ error: "default_organization" as const });
        }
        if (result.reason === "org_not_empty") {
          return reply.code(409).send({ error: "org_not_empty" as const });
        }
        return sendInvalid(reply);
      }
      return reply.code(204).send(null);
    },
  );
}
