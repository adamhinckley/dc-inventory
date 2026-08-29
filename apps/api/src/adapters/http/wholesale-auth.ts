import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import {
  loginBodySchema,
  logoutResponseSchema,
  tooManyLoginAttemptsResponseSchema,
  unauthorizedResponseSchema,
  wholesaleSessionResponseSchema,
} from "../../schemas.js";
import {
  clearSessionCookie,
  setSessionCookie,
  WHOLESALE_SESSION_COOKIE,
} from "./auth-cookies.js";
import {
  createLoginThrottlePreHandler,
  resetLoginThrottle,
} from "./login-throttle.js";

function typed(app: FastifyInstance) {
  return app.withTypeProvider<ZodTypeProvider>();
}

function unauthorized(reply: FastifyReply, request: FastifyRequest, token: string | undefined) {
  if (token !== undefined && token.length > 0) {
    clearSessionCookie(reply, WHOLESALE_SESSION_COOKIE, request);
  }
  return reply.code(401).send({ error: "unauthorized" as const });
}

export function registerWholesaleAuthRoutes(app: FastifyInstance): void {
  const routes = typed(app);

  routes.post(
    "/auth/login",
    {
      preHandler: createLoginThrottlePreHandler("wholesale"),
      schema: {
        operationId: "loginWholesale",
        tags: ["wholesale-auth"],
        summary: "Wholesale login; sets HttpOnly wholesale_session",
        body: loginBodySchema,
        response: {
          200: wholesaleSessionResponseSchema,
          401: unauthorizedResponseSchema,
          429: tooManyLoginAttemptsResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await request.server.identity.loginWholesale.execute(request.body);
      if (!result.ok) {
        return reply.code(401).send({ error: "unauthorized" as const });
      }
      await resetLoginThrottle(request, "wholesale");
      setSessionCookie(reply, WHOLESALE_SESSION_COOKIE, result.sessionId, request);
      return {
        wholesaleUserId: result.wholesaleUserId,
        email: result.email,
        customerId: result.customerId,
        organizationId: result.organizationId,
      };
    },
  );

  routes.post(
    "/auth/logout",
    {
      schema: {
        operationId: "logoutWholesale",
        tags: ["wholesale-auth"],
        summary: "Revoke wholesale session and clear cookie",
        response: {
          200: logoutResponseSchema,
          401: unauthorizedResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const token = request.cookies[WHOLESALE_SESSION_COOKIE];
      const result = await request.server.identity.logoutWholesale.execute(token);
      if (!result.ok) {
        return unauthorized(reply, request, token);
      }
      clearSessionCookie(reply, WHOLESALE_SESSION_COOKIE, request);
      return { ok: true as const };
    },
  );

  routes.get(
    "/auth/session",
    {
      schema: {
        operationId: "getWholesaleSession",
        tags: ["wholesale-auth"],
        summary: "Current wholesale session (server customerId)",
        response: {
          200: wholesaleSessionResponseSchema,
          401: unauthorizedResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const token = request.cookies[WHOLESALE_SESSION_COOKIE];
      const result = await request.server.identity.resolveWholesale.execute(token);
      if (!result.ok) {
        return unauthorized(reply, request, token);
      }
      return {
        wholesaleUserId: result.wholesaleUserId,
        email: result.email,
        customerId: result.customerId,
        organizationId: result.organizationId,
      };
    },
  );
}
