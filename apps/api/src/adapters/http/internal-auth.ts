import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import {
  loginBodySchema,
  logoutResponseSchema,
  staffSessionResponseSchema,
  unauthorizedResponseSchema,
} from "../../schemas.js";
import {
  clearSessionCookie,
  setSessionCookie,
  STAFF_SESSION_COOKIE,
} from "./auth-cookies.js";

function typed(app: FastifyInstance) {
  return app.withTypeProvider<ZodTypeProvider>();
}

function unauthorized(reply: FastifyReply, request: FastifyRequest, token: string | undefined) {
  if (token !== undefined && token.length > 0) {
    clearSessionCookie(reply, STAFF_SESSION_COOKIE, request);
  }
  return reply.code(401).send({ error: "unauthorized" as const });
}

export function registerInternalAuthRoutes(app: FastifyInstance): void {
  const routes = typed(app);

  routes.post(
    "/auth/login",
    {
      schema: {
        operationId: "loginInternal",
        tags: ["internal-auth"],
        summary: "Staff login; sets HttpOnly staff_session",
        body: loginBodySchema,
        response: {
          200: staffSessionResponseSchema,
          401: unauthorizedResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await request.server.identity.loginStaff.execute(request.body);
      if (!result.ok) {
        return reply.code(401).send({ error: "unauthorized" as const });
      }
      setSessionCookie(reply, STAFF_SESSION_COOKIE, result.sessionId, request);
      return {
        staffUserId: result.staffUserId,
        email: result.email,
        organizationId: result.organizationId,
      };
    },
  );

  routes.post(
    "/auth/logout",
    {
      schema: {
        operationId: "logoutInternal",
        tags: ["internal-auth"],
        summary: "Revoke staff session and clear cookie",
        response: {
          200: logoutResponseSchema,
          401: unauthorizedResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const token = request.cookies[STAFF_SESSION_COOKIE];
      const result = await request.server.identity.logoutStaff.execute(token);
      if (!result.ok) {
        return unauthorized(reply, request, token);
      }
      clearSessionCookie(reply, STAFF_SESSION_COOKIE, request);
      return { ok: true as const };
    },
  );

  routes.get(
    "/auth/session",
    {
      schema: {
        operationId: "getInternalSession",
        tags: ["internal-auth"],
        summary: "Current staff session",
        response: {
          200: staffSessionResponseSchema,
          401: unauthorizedResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const token = request.cookies[STAFF_SESSION_COOKIE];
      const result = await request.server.identity.resolveStaff.execute(token);
      if (!result.ok) {
        return unauthorized(reply, request, token);
      }
      return {
        staffUserId: result.staffUserId,
        email: result.email,
        organizationId: result.organizationId,
      };
    },
  );
}
