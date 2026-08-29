/**
 * Reads `DATABASE_URL` for the composition root.
 * Never log the raw URL — it may contain credentials.
 */
export class MissingDatabaseUrlError extends Error {
  override readonly name = "MissingDatabaseUrlError";

  constructor() {
    super(
      "DATABASE_URL is missing. Set it to a PostgreSQL 18 connection string (see apps/api/README.md).",
    );
  }
}

export function readDatabaseUrl(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const url = env.DATABASE_URL?.trim();
  if (!url) {
    throw new MissingDatabaseUrlError();
  }
  return url;
}
