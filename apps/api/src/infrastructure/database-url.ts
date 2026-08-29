/**
 * Reads the active Postgres URL for the composition root and Drizzle Kit.
 * Never log the raw URL — it may contain credentials.
 *
 * `DATABASE_TARGET=local|neon` picks among the named URLs. When unset, the
 * existing `DATABASE_URL` contract is unchanged (CI and Compose).
 */
export class MissingDatabaseUrlError extends Error {
  override readonly name = "MissingDatabaseUrlError";

  constructor() {
    super(
      "DATABASE_URL is missing. Set it to a PostgreSQL 18 connection string (see apps/api/README.md).",
    );
  }
}

export class MissingNeonDatabaseUrlError extends Error {
  override readonly name = "MissingNeonDatabaseUrlError";

  constructor() {
    super(
      "DATABASE_URL_NEON is missing. Set the direct (unpooled) Neon URL from `npx neon@latest env pull` (see apps/api/README.md).",
    );
  }
}

export class InvalidDatabaseTargetError extends Error {
  override readonly name = "InvalidDatabaseTargetError";

  constructor(target: string) {
    super(
      `DATABASE_TARGET "${target}" is not supported. Use local, neon, or leave it unset to read DATABASE_URL (see apps/api/README.md).`,
    );
  }
}

function requiredUrl(
  url: string | undefined,
  missing: () => Error,
): string {
  const trimmed = url?.trim();
  if (!trimmed) {
    throw missing();
  }
  return trimmed;
}

export function readDatabaseUrl(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const target = env.DATABASE_TARGET?.trim().toLowerCase();
  if (target === "neon") {
    return requiredUrl(
      env.DATABASE_URL_NEON || env.DATABASE_URL_UNPOOLED,
      () => new MissingNeonDatabaseUrlError(),
    );
  }
  if (target === "local") {
    return requiredUrl(
      env.DATABASE_URL_LOCAL || env.DATABASE_URL,
      () => new MissingDatabaseUrlError(),
    );
  }
  if (target) {
    throw new InvalidDatabaseTargetError(target);
  }
  return requiredUrl(env.DATABASE_URL, () => new MissingDatabaseUrlError());
}
