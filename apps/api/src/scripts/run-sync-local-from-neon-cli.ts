import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  MissingDatabaseUrlError,
  MissingNeonDatabaseUrlError,
  PooledDatabaseUrlError,
} from "../infrastructure/database-url.js";
import {
  parseSyncLocalFromNeonUrls,
  planSyncLocalFromNeon,
  SyncLocalFromNeonError,
  type SyncLocalFromNeonCommand,
} from "./sync-local-from-neon.js";

function loadLocalEnvFiles(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  for (const envPath of [
    resolve(here, "../../../.env"),
    resolve(here, "../../.env"),
  ]) {
    if (existsSync(envPath)) {
      process.loadEnvFile(envPath);
    }
  }
}

function runCommand(command: SyncLocalFromNeonCommand): void {
  const [bin, ...args] = command.argv;
  if (!bin) {
    throw new SyncLocalFromNeonError("Internal error: empty sync command.");
  }
  const result = spawnSync(bin, args, {
    env: { ...process.env, ...command.env },
    stdio: "inherit",
  });
  if (result.error) {
    if ("code" in result.error && result.error.code === "ENOENT") {
      throw new SyncLocalFromNeonError(
        `Missing ${bin}. Start Docker Desktop, then retry. This script uses the Compose postgres:18 service (pg_dump is not required on the host).`,
      );
    }
    throw result.error;
  }
  if (result.status !== 0) {
    throw new SyncLocalFromNeonError(
      `${bin} failed with exit ${String(result.status ?? "unknown")}.`,
    );
  }
}

loadLocalEnvFiles();

const composeFile = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../docker-compose.yml",
);

try {
  if (!existsSync(composeFile)) {
    throw new SyncLocalFromNeonError(
      `docker-compose.yml is missing at ${composeFile}.`,
    );
  }
  const plan = planSyncLocalFromNeon(parseSyncLocalFromNeonUrls(), composeFile);
  console.log(
    `Dumping Neon (development) into Compose postgres and replacing ${plan.localDatabaseName}.`,
  );
  for (const command of plan.commands) {
    runCommand(command);
  }
  console.log(`Local ${plan.localDatabaseName} now matches the Neon dump.`);
} catch (error) {
  if (
    error instanceof MissingDatabaseUrlError ||
    error instanceof MissingNeonDatabaseUrlError ||
    error instanceof PooledDatabaseUrlError ||
    error instanceof SyncLocalFromNeonError
  ) {
    console.error(error.message);
    process.exit(1);
  }
  throw error;
}
