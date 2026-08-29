import type { FastifyServerOptions } from "fastify";

export type TrustProxySetting = NonNullable<FastifyServerOptions["trustProxy"]>;
type TrustProxyFunction = Extract<TrustProxySetting, (...args: never[]) => unknown>;

export function trustProxyHopCount(hops: number): TrustProxyFunction {
  if (!Number.isInteger(hops) || hops < 1) {
    throw new Error("trust proxy hop count must be a positive integer");
  }
  return (_address: string, hop: number) => hop < hops;
}

export function readTrustProxy(raw = process.env.TRUST_PROXY): TrustProxySetting {
  const trimmed = raw?.trim();
  if (trimmed === undefined || trimmed.length === 0) {
    return false;
  }
  const value = trimmed.toLowerCase();
  if (value === "false" || value === "0") {
    return false;
  }
  if (value === "true") {
    return true;
  }
  if (/^\d+$/.test(value)) {
    return trustProxyHopCount(Number(value));
  }
  return trimmed;
}
