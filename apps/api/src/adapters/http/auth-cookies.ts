import type { CookieSerializeOptions } from "@fastify/cookie";
import type { FastifyReply, FastifyRequest } from "fastify";
import { SESSION_ABSOLUTE_MS } from "@dc-inventory/identity";

export const STAFF_SESSION_COOKIE = "staff_session";
export const WHOLESALE_SESSION_COOKIE = "wholesale_session";
export const OPS_SESSION_COOKIE = "ops_session";

/** Audience prefix so localhost dev can run internal + wholesale without cookie bleed (ports share host). */
export function sessionCookiePath(name: string): string {
  switch (name) {
    case STAFF_SESSION_COOKIE:
      return "/internal";
    case WHOLESALE_SESSION_COOKIE:
      return "/wholesale";
    case OPS_SESSION_COOKIE:
      return "/ops";
    default:
      return "/";
  }
}

export function cookieSecure(request: FastifyRequest): boolean {
  const forwarded = request.headers["x-forwarded-proto"];
  const proto = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return proto === "https" || request.protocol === "https";
}

/** Invariant X5: session cookies stay SameSite=Lax (see docs/invariants.md). */
export function cookieSameSite(_request: FastifyRequest): "lax" {
  return "lax";
}

export function sessionCookieOptions(
  request: FastifyRequest,
  name: string,
): CookieSerializeOptions {
  return {
    path: sessionCookiePath(name),
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
    ...sessionCookieOptions(request, name),
    maxAge: Math.floor(SESSION_ABSOLUTE_MS / 1000),
  });
}

/** Clears only Path=/ (legacy jar). Use on opposite-audience login so scoped sessions stay open on localhost. */
export function clearLegacySessionCookie(
  reply: FastifyReply,
  name: string,
  request: FastifyRequest,
): void {
  const options = sessionCookieOptions(request, name);
  reply.clearCookie(name, { ...options, path: "/" });
}

export function clearSessionCookie(
  reply: FastifyReply,
  name: string,
  request: FastifyRequest,
): void {
  const options = sessionCookieOptions(request, name);
  reply.clearCookie(name, options);
  // Legacy dev cookies used Path=/; localhost shares the jar across app ports.
  if (options.path !== "/") {
    reply.clearCookie(name, { ...options, path: "/" });
  }
}
