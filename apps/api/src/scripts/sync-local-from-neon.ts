import {
  MissingDatabaseUrlError,
  MissingNeonDatabaseUrlError,
  PooledDatabaseUrlError,
} from "../infrastructure/database-url.js";
import { LOCAL_DATABASE_HOSTS } from "../seed/guard/constants.js";

/** Neon production compute — never dump or restore this host. */
export const FORBIDDEN_NEON_HOST_FRAGMENTS = ["dry-dawn", "a5es0x54"] as const;

const SUPPORTED_PROTOCOLS = new Set(["postgres:", "postgresql:"]);

export class SyncLocalFromNeonError extends Error {
  override readonly name = "SyncLocalFromNeonError";
}

export type SyncLocalFromNeonUrls = {
  neonUrl: string;
  localUrl: string;
};

export type SyncLocalFromNeonCommand = {
  argv: string[];
  env?: Record<string, string>;
};

export type SyncLocalFromNeonPlan = SyncLocalFromNeonUrls & {
  dumpPath: string;
  localDatabaseName: string;
  commands: SyncLocalFromNeonCommand[];
};

function trimUrl(
  url: string | undefined,
  missing: () => Error,
): string {
  const trimmed = url?.trim();
  if (!trimmed) {
    throw missing();
  }
  return trimmed;
}

function parsePostgresUrl(url: string, label: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new SyncLocalFromNeonError(
      `${label} is malformed. Use a postgres:// or postgresql:// connection string.`,
    );
  }
  if (!SUPPORTED_PROTOCOLS.has(parsed.protocol)) {
    throw new SyncLocalFromNeonError(
      `${label} must use postgres:// or postgresql://.`,
    );
  }
  return parsed;
}

function normalizeHost(hostname: string): string {
  const trimmed = hostname.trim().toLowerCase();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function assertDirectHost(url: string): void {
  const host = normalizeHost(parsePostgresUrl(url, "DATABASE_URL").hostname);
  if (host.includes("-pooler")) {
    throw new PooledDatabaseUrlError();
  }
}

function assertNeonSourceHost(url: string): void {
  const host = normalizeHost(parsePostgresUrl(url, "DATABASE_URL_NEON").hostname);
  if (!host.endsWith(".neon.tech") && host !== "neon.tech") {
    throw new SyncLocalFromNeonError(
      `DATABASE_URL_NEON host "${host}" is not Neon. Use the direct development-branch URL.`,
    );
  }
  if (FORBIDDEN_NEON_HOST_FRAGMENTS.some((fragment) => host.includes(fragment))) {
    throw new SyncLocalFromNeonError(
      "Refusing to dump Neon production. Point DATABASE_URL_NEON at the development branch (direct / unpooled).",
    );
  }
}

function assertLocalDestinationHost(url: string): void {
  const host = normalizeHost(parsePostgresUrl(url, "DATABASE_URL_LOCAL").hostname);
  if (!LOCAL_DATABASE_HOSTS.some((allowed) => allowed === host)) {
    throw new SyncLocalFromNeonError(
      `DATABASE_URL_LOCAL host "${host}" is not allowed. Restore accepts only localhost, 127.0.0.1, ::1, and the Compose service name postgres.`,
    );
  }
}

function databaseNameFromUrl(url: string, label: string): string {
  const parsed = parsePostgresUrl(url, label);
  const name = decodeURIComponent(parsed.pathname.replace(/^\//, "")).trim();
  if (name.length === 0) {
    throw new SyncLocalFromNeonError(
      `${label} is missing a database name (e.g. …/dc_inventory).`,
    );
  }
  return name;
}

const COMPOSE_POSTGRES_SERVICE = "postgres";
const IN_CONTAINER_DUMP_PATH = "/tmp/dc-inventory-neon-sync.dump";

function composeExec(composeFile: string, inner: string[]): string[] {
  return [
    "docker",
    "compose",
    "-f",
    composeFile,
    "exec",
    "-T",
    COMPOSE_POSTGRES_SERVICE,
    ...inner,
  ];
}

function inContainerRestoreUrl(url: string): string {
  const parsed = parsePostgresUrl(url, "DATABASE_URL_LOCAL");
  parsed.hostname = "127.0.0.1";
  parsed.port = "5432";
  return parsed.toString();
}

export function parseSyncLocalFromNeonUrls(
  env: NodeJS.ProcessEnv = process.env,
): SyncLocalFromNeonUrls {
  const neonUrl = trimUrl(
    env.DATABASE_URL_NEON || env.DATABASE_URL_UNPOOLED,
    () => new MissingNeonDatabaseUrlError(),
  );
  const localUrl = trimUrl(
    env.DATABASE_URL_LOCAL || env.DATABASE_URL,
    () => new MissingDatabaseUrlError(),
  );

  assertDirectHost(neonUrl);
  assertDirectHost(localUrl);
  assertNeonSourceHost(neonUrl);
  assertLocalDestinationHost(localUrl);

  return { neonUrl, localUrl };
}

export function planSyncLocalFromNeon(
  urls: SyncLocalFromNeonUrls,
  composeFile: string,
): SyncLocalFromNeonPlan {
  const localDatabaseName = databaseNameFromUrl(urls.localUrl, "DATABASE_URL_LOCAL");
  const restoreUrl = inContainerRestoreUrl(urls.localUrl);
  const user = decodeURIComponent(
    parsePostgresUrl(urls.localUrl, "DATABASE_URL_LOCAL").username,
  );
  const roleArgs = user.length > 0 ? (["-U", user] as const) : ([] as const);

  return {
    ...urls,
    dumpPath: IN_CONTAINER_DUMP_PATH,
    localDatabaseName,
    commands: [
      {
        argv: ["docker", "compose", "-f", composeFile, "up", "-d", COMPOSE_POSTGRES_SERVICE],
      },
      {
        argv: composeExec(composeFile, [
          "pg_dump",
          "--no-owner",
          "--no-acl",
          "-Fc",
          "-d",
          urls.neonUrl,
          "-f",
          IN_CONTAINER_DUMP_PATH,
        ]),
      },
      {
        argv: composeExec(composeFile, [
          "dropdb",
          "--if-exists",
          "--force",
          ...roleArgs,
          localDatabaseName,
        ]),
      },
      {
        argv: composeExec(composeFile, ["createdb", ...roleArgs, localDatabaseName]),
      },
      {
        argv: composeExec(composeFile, [
          "pg_restore",
          "--no-owner",
          "--no-acl",
          "-d",
          restoreUrl,
          IN_CONTAINER_DUMP_PATH,
        ]),
      },
    ],
  };
}
