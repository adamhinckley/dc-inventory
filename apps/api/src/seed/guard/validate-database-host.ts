import { LOCAL_DATABASE_HOSTS } from "./constants.js";
import { DemoSeedGuardError } from "./errors.js";

const SUPPORTED_PROTOCOLS = new Set(["postgres:", "postgresql:"]);

function normalizeHost(hostname: string): string {
  const trimmed = hostname.trim().toLowerCase();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/**
 * Fail closed when `DATABASE_URL` is missing, malformed, or points outside local Compose.
 */
export function assertLocalDatabaseHost(databaseUrl: string): void {
  const trimmed = databaseUrl.trim();
  if (trimmed.length === 0) {
    throw new DemoSeedGuardError(
      "DATABASE_URL is missing. Set it to a local PostgreSQL connection string before running demo seed (see apps/api/README.md).",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new DemoSeedGuardError(
      "DATABASE_URL is malformed. Demo seed requires a postgres:// or postgresql:// connection string.",
    );
  }

  if (!SUPPORTED_PROTOCOLS.has(parsed.protocol)) {
    throw new DemoSeedGuardError(
      "DATABASE_URL must use postgres:// or postgresql://. Demo seed refuses non-Postgres URLs.",
    );
  }

  const host = normalizeHost(parsed.hostname);
  if (!LOCAL_DATABASE_HOSTS.some((allowed) => allowed === host)) {
    throw new DemoSeedGuardError(
      `DATABASE_URL host "${parsed.hostname}" is not allowed. Demo seed accepts only localhost, 127.0.0.1, ::1, and the Compose service name postgres.`,
    );
  }
}
