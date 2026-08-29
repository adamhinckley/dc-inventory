import type {
  LoginAudience,
  LoginThrottleKey,
} from "@dc-inventory/identity";
import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from "fastify";

type LoginBody = {
  organizationSlug: string;
  email: string;
};

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

export async function resetLoginThrottle(
  request: FastifyRequest,
  audience: LoginAudience,
): Promise<void> {
  await request.server.identity.loginThrottle.reset(loginThrottleKey(request, audience));
}

function loginThrottleKey(
  request: FastifyRequest,
  audience: LoginAudience,
): LoginThrottleKey {
  const body = request.body as LoginBody;
  return {
    audience,
    source: request.ip,
    accountIdentifier: `${normalize(body.organizationSlug)}\u0000${normalize(body.email)}`,
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
