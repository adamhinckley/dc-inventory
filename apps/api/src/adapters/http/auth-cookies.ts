import type { CookieSerializeOptions } from "@fastify/cookie";
import type { FastifyReply, FastifyRequest } from "fastify";
import { SESSION_ABSOLUTE_MS } from "@dc-inventory/identity";

export const STAFF_SESSION_COOKIE = "staff_session";
export const WHOLESALE_SESSION_COOKIE = "wholesale_session";
export const OPS_SESSION_COOKIE = "ops_session";

export function cookieSecure(request: FastifyRequest): boolean {
  const forwarded = request.headers["x-forwarded-proto"];
  const proto = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return proto === "https" || request.protocol === "https";
}

/**
 * Cross-site browser → Fly needs SameSite=None (Secure is required with None).
 * Same-origin Next rewrites and local :3000 → :3001 stay Lax.
 */
export function cookieSameSite(request: FastifyRequest): "lax" | "none" {
  if (!cookieSecure(request)) {
    return "lax";
  }
  const origin = request.headers.origin;
  if (typeof origin !== "string" || origin.length === 0) {
    return "lax";
  }
  let originHost: string;
  try {
    originHost = new URL(origin).hostname;
  } catch {
    return "lax";
  }
  if (originHost !== request.hostname) {
    return "none";
  }
  return "lax";
}

export function sessionCookieOptions(
  request: FastifyRequest,
): CookieSerializeOptions {
  return {
    path: "/",
    httpOnly: true,
    sameSite: cookieSameSite(request),
    secure: cookieSecure(request),
  };
}

export function setSessionCookie(
  reply: FastifyReply,
  name: string,
  value: string,
  request: FastifyRequest,
): void {
  reply.setCookie(name, value, {
    ...sessionCookieOptions(request),
    maxAge: Math.floor(SESSION_ABSOLUTE_MS / 1000),
  });
}

export function clearSessionCookie(
  reply: FastifyReply,
  name: string,
  request: FastifyRequest,
): void {
  reply.clearCookie(name, sessionCookieOptions(request));
}
