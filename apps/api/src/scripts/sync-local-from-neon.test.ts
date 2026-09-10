import { describe, expect, it } from "vitest";
import {
  MissingDatabaseUrlError,
  MissingNeonDatabaseUrlError,
  PooledDatabaseUrlError,
} from "../infrastructure/database-url.js";
import {
  parseSyncLocalFromNeonUrls,
  planSyncLocalFromNeon,
  resolveComposeFileFromHere,
  SyncLocalFromNeonError,
} from "./sync-local-from-neon.js";

const localUrl = "postgres://postgres:postgres@localhost:5432/dc_inventory";
const neonDevelopmentHost = "ep-lingering-voice-a5yv0zwz.us-east-2.aws.neon.tech";
const neonDevelopment =
  `postgresql://owner:secret@${neonDevelopmentHost}/neondb?sslmode=require`;
const neonProduction =
  "postgresql://owner:secret@ep-dry-dawn-a5es0x54.us-east-2.aws.neon.tech/neondb?sslmode=require";
const neonPooled =
  "postgresql://owner:secret@ep-lingering-voice-a5yv0zwz-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require";

function neonSyncEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    NEON_SYNC_ALLOWED_HOST: neonDevelopmentHost,
    ...overrides,
  };
}

describe("parseSyncLocalFromNeonUrls", () => {
  it("reads Neon and local URLs without using DATABASE_TARGET", () => {
    expect(
      parseSyncLocalFromNeonUrls(
        neonSyncEnv({
          DATABASE_TARGET: "local",
          DATABASE_URL: "postgres://postgres:postgres@127.0.0.1:5432/other",
          DATABASE_URL_LOCAL: `  ${localUrl}  `,
          DATABASE_URL_NEON: `  ${neonDevelopment}  `,
          DATABASE_URL_UNPOOLED: neonPooled,
        }),
      ),
    ).toEqual({ neonUrl: neonDevelopment, localUrl });
  });

  it("falls back to DATABASE_URL_UNPOOLED and DATABASE_URL", () => {
    expect(
      parseSyncLocalFromNeonUrls(
        neonSyncEnv({
          DATABASE_URL: localUrl,
          DATABASE_URL_UNPOOLED: neonDevelopment,
        }),
      ),
    ).toEqual({ neonUrl: neonDevelopment, localUrl });
  });

  it("fails when the Neon URL is missing, pooled, not allowlisted, or not Neon", () => {
    expect(() => parseSyncLocalFromNeonUrls({ DATABASE_URL_LOCAL: localUrl })).toThrow(
      MissingNeonDatabaseUrlError,
    );
    expect(() =>
      parseSyncLocalFromNeonUrls(
        neonSyncEnv({
          DATABASE_URL_LOCAL: localUrl,
          DATABASE_URL_NEON: neonPooled,
        }),
      ),
    ).toThrow(PooledDatabaseUrlError);
    expect(() =>
      parseSyncLocalFromNeonUrls({
        DATABASE_URL_LOCAL: localUrl,
        DATABASE_URL_NEON: neonDevelopment,
      }),
    ).toThrow(/NEON_SYNC_ALLOWED_HOST is missing/);
    expect(() =>
      parseSyncLocalFromNeonUrls(
        neonSyncEnv({
          DATABASE_URL_LOCAL: localUrl,
          DATABASE_URL_NEON: neonProduction,
        }),
      ),
    ).toThrow(/Refusing to dump Neon host/);
    expect(() =>
      parseSyncLocalFromNeonUrls(
        neonSyncEnv({
          DATABASE_URL_LOCAL: localUrl,
          DATABASE_URL_NEON: "postgres://owner:secret@db.example.com/neondb",
        }),
      ),
    ).toThrow(/not Neon/);
  });

  it("fails when the restore target is missing or not local", () => {
    expect(() =>
      parseSyncLocalFromNeonUrls(neonSyncEnv({ DATABASE_URL_NEON: neonDevelopment })),
    ).toThrow(MissingDatabaseUrlError);
    expect(() =>
      parseSyncLocalFromNeonUrls(
        neonSyncEnv({
          DATABASE_URL_NEON: neonDevelopment,
          DATABASE_URL_LOCAL: neonDevelopment,
        }),
      ),
    ).toThrow(SyncLocalFromNeonError);
    expect(() =>
      parseSyncLocalFromNeonUrls(
        neonSyncEnv({
          DATABASE_URL_NEON: neonDevelopment,
          DATABASE_URL_LOCAL: neonDevelopment,
        }),
      ),
    ).toThrow(/not allowed/);
  });
});

describe("planSyncLocalFromNeon", () => {
  it("runs dump, drop, create, and restore inside Compose postgres:18", () => {
    const composeFile = "/repo/docker-compose.yml";
    const plan = planSyncLocalFromNeon(
      { neonUrl: neonDevelopment, localUrl },
      composeFile,
    );
    const execPrefix = [
      "docker",
      "compose",
      "-f",
      composeFile,
      "exec",
      "-T",
      "postgres",
    ];

    expect(plan.localDatabaseName).toBe("dc_inventory");
    expect(plan.dumpPath).toBe("/tmp/dc-inventory-neon-sync.dump");
    expect(plan.commands[0]?.argv).toEqual([
      "docker",
      "compose",
      "-f",
      composeFile,
      "up",
      "-d",
      "--wait",
      "postgres",
    ]);
    expect(plan.commands[1]?.argv).toEqual([
      ...execPrefix,
      "pg_dump",
      "--no-owner",
      "--no-acl",
      "-Fc",
      "-d",
      neonDevelopment,
      "-f",
      "/tmp/dc-inventory-neon-sync.dump",
    ]);
    expect(plan.commands[2]?.argv).toEqual([
      ...execPrefix,
      "dropdb",
      "--if-exists",
      "--force",
      "-U",
      "postgres",
      "dc_inventory",
    ]);
    expect(plan.commands[3]?.argv).toEqual([
      ...execPrefix,
      "createdb",
      "-U",
      "postgres",
      "dc_inventory",
    ]);
    expect(plan.commands[4]?.argv).toEqual([
      ...execPrefix,
      "pg_restore",
      "--no-owner",
      "--no-acl",
      "-d",
      "postgres://postgres:postgres@127.0.0.1:5432/dc_inventory",
      "/tmp/dc-inventory-neon-sync.dump",
    ]);
  });
});

describe("resolveComposeFileFromHere", () => {
  it("finds the repo-root compose file from apps/api/src/scripts", () => {
    expect(
      resolveComposeFileFromHere(
        "/Users/adam/projects/dc-inventory/apps/api/src/scripts",
        (path) => path === "/Users/adam/projects/dc-inventory/docker-compose.yml",
      ),
    ).toBe("/Users/adam/projects/dc-inventory/docker-compose.yml");
  });

  it("fails when compose is not in any parent directory", () => {
    expect(() =>
      resolveComposeFileFromHere("/Users/adam/projects/dc-inventory/apps/api/src/scripts", () => false),
    ).toThrow(/was not found/);
  });
});
