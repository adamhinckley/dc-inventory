import type { FastifyInstance, FastifyReply } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import {
  createInternalOrganizationBodySchema,
  createInternalOrganizationResponseSchema,
  forbiddenResponseSchema,
  invalidResponseSchema,
  inviteFailedResponseSchema,
  licensingTwinFailedResponseSchema,
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

export function registerInternalOrganizationRoutes(app: FastifyInstance): void {
  const routes = typed(app);

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
}
