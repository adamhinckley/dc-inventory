import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import {
  internalSessionResponseSchema,
  internalSetPasswordBodySchema,
  internalLoginBodySchema,
  loginBodySchema,
  logoutResponseSchema,
  setPasswordFailureResponseSchema,
  setPasswordSuccessResponseSchema,
  tooManyLoginAttemptsResponseSchema,
  unauthorizedResponseSchema,
} from "../../schemas.js";
import {
  clearLegacySessionCookie,
  clearSessionCookie,
  setSessionCookie,
  STAFF_SESSION_COOKIE,
  WHOLESALE_SESSION_COOKIE,
} from "./auth-cookies.js";
import {
  createInternalLoginThrottlePreHandler,
  resetInternalLoginThrottle,
} from "./login-throttle.js";

function typed(app: FastifyInstance) {
  return app.withTypeProvider<ZodTypeProvider>();
}

function unauthorized(reply: FastifyReply, request: FastifyRequest, token: string | undefined) {
  if (token !== undefined && token.length > 0) {
    clearSessionCookie(reply, STAFF_SESSION_COOKIE, request);
  }
  return reply.code(401).send({ error: "unauthorized" as const });
}

function isStaffLogin(body: { organizationSlug?: string }): boolean {
  return body.organizationSlug !== undefined && body.organizationSlug.trim().length > 0;
}

export function registerInternalAuthRoutes(app: FastifyInstance): void {
  const routes = typed(app);

  routes.post(
    "/auth/login",
    {
      preHandler: createInternalLoginThrottlePreHandler(),
      schema: {
        operationId: "loginInternal",
        tags: ["internal-auth"],
        summary: "Staff or Platform login; sets HttpOnly staff_session",
        body: internalLoginBodySchema,
        response: {
          200: internalSessionResponseSchema,
          401: unauthorizedResponseSchema,
          429: tooManyLoginAttemptsResponseSchema,
        },
      },
    },
    async (request, reply) => {
      if (isStaffLogin(request.body)) {
        const result = await request.server.identity.loginStaff.execute({
          organizationSlug: request.body.organizationSlug!.trim(),
          email: request.body.email,
          password: request.body.password,
        });
        if (!result.ok) {
          return reply.code(401).send({ error: "unauthorized" as const });
        }
        await resetInternalLoginThrottle(request, "staff");
        clearLegacySessionCookie(reply, WHOLESALE_SESSION_COOKIE, request);
        setSessionCookie(reply, STAFF_SESSION_COOKIE, result.sessionId, request);
        return {
          audience: "staff" as const,
          staffUserId: result.staffUserId,
          email: result.email,
          displayName: result.displayName,
          organizationId: result.organizationId,
          roles: [...result.roles],
        };
      }

      const result = await request.server.identity.loginPlatform.execute({
        email: request.body.email,
        password: request.body.password,
      });
      if (!result.ok) {
        return reply.code(401).send({ error: "unauthorized" as const });
      }
      await resetInternalLoginThrottle(request, "platform");
      clearLegacySessionCookie(reply, WHOLESALE_SESSION_COOKIE, request);
      setSessionCookie(reply, STAFF_SESSION_COOKIE, result.sessionId, request);
      return {
        audience: "platform" as const,
        platformUserId: result.platformUserId,
        email: result.email,
        displayName: result.displayName,
      };
    },
  );

  routes.post(
    "/auth/logout",
    {
      schema: {
        operationId: "logoutInternal",
        tags: ["internal-auth"],
        summary: "Revoke staff or platform session and clear cookie",
        response: {
          200: logoutResponseSchema,
          401: unauthorizedResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const token = request.cookies[STAFF_SESSION_COOKIE];
      const staffResult = await request.server.identity.logoutStaff.execute(token);
      if (staffResult.ok) {
        clearSessionCookie(reply, STAFF_SESSION_COOKIE, request);
        return { ok: true as const };
      }
      const platformResult = await request.server.identity.logoutPlatform.execute(token);
      if (!platformResult.ok) {
        return unauthorized(reply, request, token);
      }
      clearSessionCookie(reply, STAFF_SESSION_COOKIE, request);
      return { ok: true as const };
    },
  );

  routes.post(
    "/auth/set-password",
    {
      schema: {
        operationId: "setPasswordInternal",
        tags: ["internal-auth"],
        summary: "Set staff or platform password from invite token",
        body: internalSetPasswordBodySchema,
        response: {
          200: setPasswordSuccessResponseSchema,
          400: setPasswordFailureResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const audience = request.body.audience ?? "staff";
      const result = await request.server.identity.setPasswordStaff.execute({
        token: request.body.token,
        password: request.body.password,
        audience,
      });
      if (!result.ok) {
        if (result.reason === "password_policy") {
          return reply.code(400).send({ error: "invalid" as const, violation: result.violation });
        }
        return reply.code(400).send({ error: "invalid" as const });
      }
      return { ok: true as const };
    },
  );

  routes.get(
    "/auth/session",
    {
      schema: {
        operationId: "getInternalSession",
        tags: ["internal-auth"],
        summary: "Current staff or platform session",
        response: {
          200: internalSessionResponseSchema,
          401: unauthorizedResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const token = request.cookies[STAFF_SESSION_COOKIE];
      const staffResult = await request.server.identity.resolveStaff.execute(token);
      if (staffResult.ok) {
        return {
          audience: "staff" as const,
          staffUserId: staffResult.staffUserId,
          email: staffResult.email,
          displayName: staffResult.displayName,
          organizationId: staffResult.organizationId,
          roles: [...staffResult.roles],
        };
      }
      const platformResult = await request.server.identity.resolvePlatform.execute(token);
      if (!platformResult.ok) {
        return unauthorized(reply, request, token);
      }
      return {
        audience: "platform" as const,
        platformUserId: platformResult.platformUserId,
        email: platformResult.email,
        displayName: platformResult.displayName,
      };
    },
  );
}
