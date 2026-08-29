import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import {
  loginBodySchema,
  logoutResponseSchema,
  opsSessionResponseSchema,
  tooManyLoginAttemptsResponseSchema,
  unauthorizedResponseSchema,
} from "../../schemas.js";
import {
  clearSessionCookie,
  OPS_SESSION_COOKIE,
  setSessionCookie,
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
    clearSessionCookie(reply, OPS_SESSION_COOKIE, request);
  }
  return reply.code(401).send({ error: "unauthorized" as const });
}

export function registerOpsLoginRoute(app: FastifyInstance): void {
  typed(app).post(
    "/auth/login",
    {
      preHandler: createLoginThrottlePreHandler("ops"),
      schema: {
        operationId: "loginOps",
        tags: ["ops-auth"],
        summary: "Ops login; sets HttpOnly ops_session",
        body: loginBodySchema,
        response: {
          200: opsSessionResponseSchema,
          401: unauthorizedResponseSchema,
          429: tooManyLoginAttemptsResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await request.server.identity.loginOps.execute(request.body);
      if (!result.ok) {
        return reply.code(401).send({ error: "unauthorized" as const });
      }
      await resetLoginThrottle(request, "ops");
      setSessionCookie(reply, OPS_SESSION_COOKIE, result.sessionId, request);
      return {
        opsUserId: result.opsUserId,
        email: result.email,
        kind: result.kind,
        tenantId: result.tenantId,
      };
    },
  );
}

export function registerProtectedOpsAuthRoutes(app: FastifyInstance): void {
  const routes = typed(app);

  routes.post(
    "/auth/logout",
    {
      schema: {
        operationId: "logoutOps",
        tags: ["ops-auth"],
        summary: "Revoke ops session and clear cookie",
        response: {
          200: logoutResponseSchema,
          401: unauthorizedResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const token = request.cookies[OPS_SESSION_COOKIE];
      const result = await request.server.identity.logoutOps.execute(token);
      if (!result.ok) {
        return unauthorized(reply, request, token);
      }
      clearSessionCookie(reply, OPS_SESSION_COOKIE, request);
      return { ok: true as const };
    },
  );

  routes.get(
    "/auth/session",
    {
      schema: {
        operationId: "getOpsSession",
        tags: ["ops-auth"],
        summary: "Current operator or business-owner session",
        response: {
          200: opsSessionResponseSchema,
          401: unauthorizedResponseSchema,
        },
      },
    },
    async (request) => {
      const actor = request.opsAuth;
      if (actor === undefined) {
        throw new Error("ops audience guard did not set opsAuth");
      }
      return actor;
    },
  );
}
