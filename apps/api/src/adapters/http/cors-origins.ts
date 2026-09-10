const DEFAULT_ORIGINS =
  "http://localhost:3000,http://localhost:3002,http://dc-internal.test:3000,http://dc-wholesale.test:3002";

export function readCorsOrigins(raw = process.env.CORS_ORIGINS): string[] {
  const value = raw?.trim() ? raw : DEFAULT_ORIGINS;
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

export function assertNoWildcardOrigins(origins: string[]): void {
  if (origins.includes("*")) {
    throw new Error("CORS_ORIGINS must not include *");
  }
}

export function isAllowedCorsOrigin(origin: string, origins = readCorsOrigins()): boolean {
  assertNoWildcardOrigins(origins);
  return origins.includes(origin);
}
