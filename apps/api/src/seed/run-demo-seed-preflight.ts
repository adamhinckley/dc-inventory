import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readDatabaseUrl } from "../infrastructure/database-url.js";
import { createDatabaseConnection } from "../infrastructure/db.js";
import {
  assertDemoSeedPreflight,
  DemoSeedGuardError,
  PostgresDemoBookOccupancy,
  PostgresDemoBookReset,
} from "./guard/index.js";

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

loadLocalEnvFiles();

try {
  const databaseUrl = readDatabaseUrl();
  const connection = createDatabaseConnection(databaseUrl);
  await assertDemoSeedPreflight({
    databaseUrl,
    resetOptIn: process.env.DEMO_SEED_RESET,
    occupancy: new PostgresDemoBookOccupancy(connection.sql),
    reset: new PostgresDemoBookReset(connection.sql),
  });
  await connection.sql.end({ timeout: 5 });
  console.log("Demo seed preflight passed (local host, occupancy, reset guard).");
} catch (error) {
  if (error instanceof DemoSeedGuardError) {
    console.error(error.message);
    process.exit(1);
  }
  throw error;
}
