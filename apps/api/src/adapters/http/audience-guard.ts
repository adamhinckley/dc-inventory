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

const PLATFORM_OPERATION_IDS = new Set([
  "createInternalOrganization",
  "listInternalOrganizations",
  "deleteInternalOrganization",
]);

function isPlatformRoute(request: FastifyRequest): boolean {
  const schema = request.routeOptions.schema as { operationId?: string } | undefined;
  return (
    schema?.operationId !== undefined && PLATFORM_OPERATION_IDS.has(schema.operationId)
  );
}

function isOpsLoginRoute(request: FastifyRequest): boolean {
  const url = request.routeOptions.url ?? request.url.split("?")[0] ?? "";
  return url === "/auth/login" || url === "/ops/auth/login";
}

function sendUnauthorized(reply: FastifyReply) {
  return reply.code(401).send({ error: "unauthorized" as const });
}

function sendNeedsCustomer(reply: FastifyReply) {
  return reply.code(403).send({ error: "needs_customer" as const });
}

export function registerStaffAudienceGuard(app: FastifyInstance): void {
  app.addHook("preHandler", async (request, reply) => {
    if (isAuthRoute(request)) {
      return;
    }
    if (request.staffAuth !== undefined) {
      return;
    }
    if (request.platformAuth !== undefined) {
      if (isPlatformRoute(request)) {
        return;
      }
      return sendUnauthorized(reply);
    }
    const token = request.cookies[STAFF_SESSION_COOKIE];
    const staffResult = await request.server.identity.resolveStaff.execute(token);
    if (staffResult.ok) {
      request.staffAuth = {
        staffUserId: staffResult.staffUserId,
        email: staffResult.email,
        organizationId: staffResult.organizationId,
        roles: staffResult.roles,
      };
      return;
    }
    const platformResult = await request.server.identity.resolvePlatform.execute(token);
    if (platformResult.ok) {
      if (!isPlatformRoute(request)) {
        return sendUnauthorized(reply);
      }
      request.platformAuth = {
        platformUserId: platformResult.platformUserId,
        email: platformResult.email,
      };
      return;
    }
    if (token !== undefined && token.length > 0) {
      clearSessionCookie(reply, STAFF_SESSION_COOKIE, request);
    }
    return sendUnauthorized(reply);
  });
}

export function registerWholesaleAudienceGuard(app: FastifyInstance): void {
  app.addHook("preHandler", async (request, reply) => {
    if (isAuthRoute(request)) {
      return;
    }
    if (request.wholesaleAuth !== undefined) {
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
    if ("mode" in result && result.mode === "staff_acting") {
      request.wholesaleAuth = {
        mode: "staff_acting",
        staffUserId: result.staffUserId,
        wholesaleUserId: null,
        email: result.email,
        customerId: result.customerId,
        organizationId: result.organizationId,
      };
    } else {
      request.wholesaleAuth = {
        mode: "buyer",
        staffUserId: null,
        wholesaleUserId: result.wholesaleUserId,
        email: result.email,
        customerId: result.customerId,
        organizationId: result.organizationId,
      };
    }
    if (request.wholesaleAuth.customerId === null) {
      return sendNeedsCustomer(reply);
    }
  });
}

export function registerOpsAudienceGuard(app: FastifyInstance): void {
  app.addHook("preHandler", async (request, reply) => {
    if (isOpsLoginRoute(request)) {
      return;
    }
    if (request.opsAuth !== undefined) {
      return;
    }
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
