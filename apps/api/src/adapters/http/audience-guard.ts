import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  clearSessionCookie,
  OPS_SESSION_COOKIE,
  STAFF_SESSION_COOKIE,
  WHOLESALE_SESSION_COOKIE,
} from "./auth-cookies.js";

function isAuthRoute(request: FastifyRequest): boolean {
  const url = request.routeOptions.url ?? request.url.split("?")[0] ?? "";
  return url.includes("/auth/");
}

function sendUnauthorized(reply: FastifyReply) {
  return reply.code(401).send({ error: "unauthorized" as const });
}

export function registerStaffAudienceGuard(app: FastifyInstance): void {
  app.addHook("preHandler", async (request, reply) => {
    if (isAuthRoute(request)) {
      return;
    }
    const token = request.cookies[STAFF_SESSION_COOKIE];
    const result = await request.server.identity.resolveStaff.execute(token);
    if (!result.ok) {
      if (token !== undefined && token.length > 0) {
        clearSessionCookie(reply, STAFF_SESSION_COOKIE, request);
      }
      return sendUnauthorized(reply);
    }
    request.staffAuth = {
      staffUserId: result.staffUserId,
      email: result.email,
      organizationId: result.organizationId,
    };
  });
}

export function registerWholesaleAudienceGuard(app: FastifyInstance): void {
  app.addHook("preHandler", async (request, reply) => {
    if (isAuthRoute(request)) {
      return;
    }
    const token = request.cookies[WHOLESALE_SESSION_COOKIE];
    const result = await request.server.identity.resolveWholesale.execute(token);
    if (!result.ok) {
      if (token !== undefined && token.length > 0) {
        clearSessionCookie(reply, WHOLESALE_SESSION_COOKIE, request);
      }
      return sendUnauthorized(reply);
    }
    request.wholesaleAuth = {
      wholesaleUserId: result.wholesaleUserId,
      email: result.email,
      customerId: result.customerId,
      organizationId: result.organizationId,
    };
  });
}

export function registerOpsAudienceGuard(app: FastifyInstance): void {
  app.addHook("preHandler", async (request, reply) => {
    const token = request.cookies[OPS_SESSION_COOKIE];
    const result = await request.server.identity.resolveOps.execute(token);
    if (!result.ok) {
      if (token !== undefined && token.length > 0) {
        clearSessionCookie(reply, OPS_SESSION_COOKIE, request);
      }
      return sendUnauthorized(reply);
    }
    request.opsAuth = {
      opsUserId: result.opsUserId,
      email: result.email,
      kind: result.kind,
      tenantId: result.tenantId,
    };
  });
}
