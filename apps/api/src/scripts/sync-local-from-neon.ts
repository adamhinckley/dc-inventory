import { resolve } from "node:path";
import {
  MissingDatabaseUrlError,
  MissingNeonDatabaseUrlError,
  PooledDatabaseUrlError,
} from "../infrastructure/database-url.js";
import { LOCAL_DATABASE_HOSTS } from "../seed/guard/constants.js";

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

function assertDirectHost(url: string, label = "DATABASE_URL"): void {
  const host = normalizeHost(parsePostgresUrl(url, label).hostname);
  if (host.includes("-pooler")) {
    throw new PooledDatabaseUrlError();
  }
}

function readAllowedNeonSyncHost(env: NodeJS.ProcessEnv): string {
  const allowed = env.NEON_SYNC_ALLOWED_HOST?.trim();
  if (!allowed) {
    throw new SyncLocalFromNeonError(
      "NEON_SYNC_ALLOWED_HOST is missing. Set it to the exact direct development-branch hostname you intend to dump (see apps/api/.env.example).",
    );
  }
  return normalizeHost(allowed);
}

function assertNeonSourceHost(url: string, env: NodeJS.ProcessEnv): void {
  const host = normalizeHost(parsePostgresUrl(url, "DATABASE_URL_NEON").hostname);
  if (!host.endsWith(".neon.tech") && host !== "neon.tech") {
    throw new SyncLocalFromNeonError(
      `DATABASE_URL_NEON host "${host}" is not Neon. Use the direct development-branch URL.`,
    );
  }
  const allowed = readAllowedNeonSyncHost(env);
  if (host !== allowed) {
    throw new SyncLocalFromNeonError(
      `Refusing to dump Neon host "${host}". NEON_SYNC_ALLOWED_HOST is "${allowed}". Point DATABASE_URL_NEON at the development branch and set NEON_SYNC_ALLOWED_HOST to its exact hostname.`,
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

  assertDirectHost(neonUrl, "DATABASE_URL_NEON");
  assertDirectHost(localUrl, "DATABASE_URL_LOCAL");
  assertNeonSourceHost(neonUrl, env);
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
        argv: [
          "docker",
          "compose",
          "-f",
          composeFile,
          "up",
          "-d",
          "--wait",
          COMPOSE_POSTGRES_SERVICE,
        ],
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

const COMPOSE_FILE_NAME = "docker-compose.yml";
const COMPOSE_SEARCH_DEPTH = 8;

export function resolveComposeFileFromHere(
  startDir: string,
  exists: (path: string) => boolean,
): string {
  let dir = resolve(startDir);
  for (let i = 0; i < COMPOSE_SEARCH_DEPTH; i += 1) {
    const candidate = resolve(dir, COMPOSE_FILE_NAME);
    if (exists(candidate)) {
      return candidate;
    }
    const parent = resolve(dir, "..");
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  throw new SyncLocalFromNeonError(
    `docker-compose.yml was not found walking up from ${resolve(startDir)}.`,
  );
}
