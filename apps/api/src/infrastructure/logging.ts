import type { FastifyServerOptions } from "fastify";

const REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  "req.headers['set-cookie']",
] as const;

/**
 * Fastify/Pino JSON logger (no pretty transport). requestId is attached by
 * Fastify via `requestIdLogLabel` in `request-id.ts`.
 */
export function pinoLoggerOptions(
  level = process.env.LOG_LEVEL ?? "info",
): Exclude<FastifyServerOptions["logger"], boolean | undefined> {
  return {
    level,
    redact: {
      paths: [...REDACT_PATHS],
      remove: true,
    },
  };
}
