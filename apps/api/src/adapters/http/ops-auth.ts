import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import {
  loginBodySchema,
  tooManyLoginAttemptsResponseSchema,
  unauthorizedResponseSchema,
} from "../../schemas.js";
import { createLoginThrottlePreHandler } from "./login-throttle.js";

function typed(app: FastifyInstance) {
  return app.withTypeProvider<ZodTypeProvider>();
}

export function registerOpsAuthRoutes(app: FastifyInstance): void {
  const routes = typed(app);

  routes.post(
    "/auth/login",
    {
      preHandler: createLoginThrottlePreHandler("ops"),
      schema: {
        operationId: "loginOps",
        tags: ["ops-auth"],
        summary: "Ops login (throttled; credential verification not yet implemented)",
        body: loginBodySchema,
        response: {
          401: unauthorizedResponseSchema,
          429: tooManyLoginAttemptsResponseSchema,
        },
      },
    },
    async (_request, reply) => reply.code(401).send({ error: "unauthorized" as const }),
  );
}
