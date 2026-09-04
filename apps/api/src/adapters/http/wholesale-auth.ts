import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  conflictResponseSchema,
  listActingCustomersResponseSchema,
  loginBodySchema,
  logoutResponseSchema,
  notFoundResponseSchema,
  selectActingCustomerBodySchema,
  tooManyLoginAttemptsResponseSchema,
  unauthorizedResponseSchema,
  wholesaleSessionResponseSchema,
} from "../../schemas.js";
import {
  clearLegacySessionCookie,
  clearSessionCookie,
  setSessionCookie,
  STAFF_SESSION_COOKIE,
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

function notFound(reply: FastifyReply) {
  return reply.code(404).send({ error: "not_found" as const });
}

function actingRouteUnauthorized(
  reply: FastifyReply,
  request: FastifyRequest,
  token: string | undefined,
  reason: string,
) {
  if (reason === "buyer_session") {
    return notFound(reply);
  }
  return unauthorized(reply, request, token);
}

type WholesaleSessionBody = z.infer<typeof wholesaleSessionResponseSchema>;

function toWholesaleSessionBody(
  result:
    | {
        mode: "staff_acting";
        staffUserId: string;
        customerId: string | null;
        email: string;
        organizationId: string;
      }
    | {
        mode?: "buyer";
        wholesaleUserId: string;
        customerId: string;
        email: string;
        organizationId: string;
      },
): WholesaleSessionBody {
  if ("mode" in result && result.mode === "staff_acting") {
    return {
      mode: "staff_acting",
      staffUserId: result.staffUserId,
      wholesaleUserId: null,
      customerId: result.customerId,
      email: result.email,
      organizationId: result.organizationId,
    };
  }
  return {
    mode: "buyer",
    staffUserId: null,
    wholesaleUserId: result.wholesaleUserId,
    customerId: result.customerId,
    email: result.email,
    organizationId: result.organizationId,
  };
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
      clearLegacySessionCookie(reply, STAFF_SESSION_COOKIE, request);
      setSessionCookie(reply, WHOLESALE_SESSION_COOKIE, result.sessionId, request);
      return toWholesaleSessionBody(result);
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
      return toWholesaleSessionBody(result);
    },
  );

  routes.get(
    "/auth/customers",
    {
      schema: {
        operationId: "listActingCustomers",
        tags: ["wholesale-auth"],
        summary: "List customers available for staff acting selection",
        response: {
          200: listActingCustomersResponseSchema,
          401: unauthorizedResponseSchema,
          404: notFoundResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const token = request.cookies[WHOLESALE_SESSION_COOKIE];
      const result = await request.server.identity.listActingCustomers.execute(token);
      if (!result.ok) {
        return actingRouteUnauthorized(reply, request, token, result.reason);
      }
      return { items: [...result.items] };
    },
  );

  routes.post(
    "/auth/select-customer",
    {
      schema: {
        operationId: "selectActingCustomer",
        tags: ["wholesale-auth"],
        summary: "Bind a customer to a staff-acting wholesale session",
        body: selectActingCustomerBodySchema,
        response: {
          200: wholesaleSessionResponseSchema,
          401: unauthorizedResponseSchema,
          404: notFoundResponseSchema,
          409: conflictResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const token = request.cookies[WHOLESALE_SESSION_COOKIE];
      const result = await request.server.identity.selectActingCustomer.execute(
        token,
        request.body,
      );
      if (!result.ok) {
        if (result.reason === "inactive") {
          return reply.code(409).send({ error: "conflict" as const });
        }
        if (result.reason === "not_found" || result.reason === "buyer_session") {
          return notFound(reply);
        }
        return actingRouteUnauthorized(reply, request, token, result.reason);
      }
      const session = await request.server.identity.resolveWholesale.execute(token);
      if (!session.ok) {
        return unauthorized(reply, request, token);
      }
      return toWholesaleSessionBody(session);
    },
  );

  routes.post(
    "/auth/clear-customer",
    {
      schema: {
        operationId: "clearActingCustomer",
        tags: ["wholesale-auth"],
        summary: "Clear the customer binding from a staff-acting wholesale session",
        response: {
          200: wholesaleSessionResponseSchema,
          401: unauthorizedResponseSchema,
          404: notFoundResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const token = request.cookies[WHOLESALE_SESSION_COOKIE];
      const result = await request.server.identity.clearActingCustomer.execute(token);
      if (!result.ok) {
        return actingRouteUnauthorized(reply, request, token, result.reason);
      }
      const session = await request.server.identity.resolveWholesale.execute(token);
      if (!session.ok) {
        return unauthorized(reply, request, token);
      }
      return toWholesaleSessionBody(session);
    },
  );
}
