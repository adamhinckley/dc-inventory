import type {
  LoginAudience,
  LoginThrottleKey,
} from "@dc-inventory/identity";
import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from "fastify";

type LoginBody = {
  organizationSlug?: string;
  email: string;
};

function isStaffLogin(body: LoginBody): boolean {
  return body.organizationSlug !== undefined && body.organizationSlug.trim().length > 0;
}

export function createInternalLoginThrottlePreHandler(): preHandlerHookHandler {
  return async (request, reply) => {
    const audience: LoginAudience = isStaffLogin(request.body as LoginBody)
      ? "staff"
      : "platform";
    const result = await request.server.identity.loginThrottle.attempt(
      loginThrottleKey(request, audience),
    );
    if (result.allowed) {
      return;
    }
    sendTooManyLoginAttempts(reply, result.retryAfterSeconds);
  };
}

export function createLoginThrottlePreHandler(
  audience: LoginAudience,
): preHandlerHookHandler {
  return async (request, reply) => {
    const result = await request.server.identity.loginThrottle.attempt(
      loginThrottleKey(request, audience),
    );
    if (result.allowed) {
      return;
    }
    sendTooManyLoginAttempts(reply, result.retryAfterSeconds);
  };
}

export async function resetInternalLoginThrottle(
  request: FastifyRequest,
  audience: LoginAudience,
): Promise<void> {
  await request.server.identity.loginThrottle.reset(loginThrottleKey(request, audience));
}

export async function resetLoginThrottle(
  request: FastifyRequest,
  audience: LoginAudience,
): Promise<void> {
  await resetInternalLoginThrottle(request, audience);
}

function loginThrottleKey(
  request: FastifyRequest,
  audience: LoginAudience,
): LoginThrottleKey {
  const body = request.body as LoginBody;
  const accountIdentifier =
    audience === "platform"
      ? normalize(body.email)
      : `${normalize(body.organizationSlug ?? "")}\u0000${normalize(body.email)}`;
  return {
    audience,
    source: request.ip,
    accountIdentifier,
  };
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function sendTooManyLoginAttempts(reply: FastifyReply, retryAfterSeconds: number): void {
  reply
    .header("Retry-After", retryAfterSeconds.toString())
    .code(429)
    .send({
      error: "too_many_login_attempts",
      retryAfterSeconds,
    });
}
