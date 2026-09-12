import type { FastifyInstance, FastifyReply } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import type { StaffUser } from "@dc-inventory/identity";
import {
  duplicateEmailResponseSchema,
  invalidResponseSchema,
  staffUserItemSchema,
  staffUserWriteBodySchema,
  unauthorizedResponseSchema,
  zodValidationErrorResponseSchema,
} from "../../schemas.js";
import { staffOrganizationId } from "./org-session.js";

function typed(app: FastifyInstance) {
  return app.withTypeProvider<ZodTypeProvider>();
}

function sendInvalid(reply: FastifyReply) {
  return reply.code(400).send({ error: "invalid" as const });
}

function sendDuplicateEmail(reply: FastifyReply) {
  return reply.code(409).send({ error: "duplicate_email" as const });
}

function mapStaffUser(user: StaffUser) {
  return {
    id: user.id,
    displayName: user.displayName,
    email: user.email,
    roles: [...user.roles],
  };
}

export function registerInternalStaffRoutes(app: FastifyInstance): void {
  const routes = typed(app);

  routes.post(
    "/staff",
    {
      schema: {
        operationId: "createInternalStaff",
        tags: ["internal-staff"],
        summary: "Create staff user and send invite",
        body: staffUserWriteBodySchema,
        response: {
          201: staffUserItemSchema,
          400: z.union([invalidResponseSchema, zodValidationErrorResponseSchema]),
          401: unauthorizedResponseSchema,
          409: duplicateEmailResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await request.server.identity.createStaffUser.execute({
        organizationId: staffOrganizationId(request),
        displayName: request.body.displayName,
        email: request.body.email,
        roles: request.body.roles,
      });
      if (!result.ok) {
        return result.reason === "email_taken"
          ? sendDuplicateEmail(reply)
          : sendInvalid(reply);
      }
      return reply.code(201).send(mapStaffUser(result.staffUser));
    },
  );
}
