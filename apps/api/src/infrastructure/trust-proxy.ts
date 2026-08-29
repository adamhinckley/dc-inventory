import type { FastifyServerOptions } from "fastify";

export type TrustProxySetting = NonNullable<FastifyServerOptions["trustProxy"]>;

export function readTrustProxy(raw = process.env.TRUST_PROXY): TrustProxySetting {
  const value = raw?.trim().toLowerCase();
  if (value === undefined || value.length === 0 || value === "false" || value === "0") {
    return false;
  }
  if (value === "true" || value === "1") {
    return true;
  }
  return raw!.trim();
}
