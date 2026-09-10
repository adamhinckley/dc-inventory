import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { MissingDatabaseUrlError } from "../infrastructure/database-url.js";
import { createDatabaseConnection } from "../infrastructure/db.js";
import { parseDemoSeedConfig } from "./demo-seed-config.js";
import { startDemoSeedDeadline } from "./demo-seed-deadline.js";
import { createConsoleProgressReporter } from "./demo-seed-progress.js";
import {
  assertDemoSeedPreflight,
  assertLocalDatabaseHost,
  DemoSeedGuardError,
  PostgresDemoBookOccupancy,
  PostgresDemoBookReset,
} from "./guard/index.js";
import { planCliDemoBook } from "./plan-cli-demo-book.js";
import { DEMO_NAMED_CUSTOMERS } from "./reconciliation/expectations.js";
import { Phase1SeedError } from "./run-phase1-seed.js";
import { runDemoSeedOnDb } from "./run-demo-seed-on-db.js";

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
  const config = parseDemoSeedConfig();
  assertLocalDatabaseHost(config.databaseUrl);

  const deadline = startDemoSeedDeadline();
  const onProgress = createConsoleProgressReporter();

  onProgress("preflight");
  const connection = createDatabaseConnection(config.databaseUrl);
  await assertDemoSeedPreflight({
    databaseUrl: config.databaseUrl,
    resetOptIn: config.resetOptIn,
    occupancy: new PostgresDemoBookOccupancy(connection.sql),
    reset: new PostgresDemoBookReset(connection.sql),
  });

  const seedToday = new Date();
  const { plan, expectations } = planCliDemoBook({
    profile: config.profile,
    seed: config.seed,
    seedToday,
  });

  const result = await runDemoSeedOnDb({
    db: connection.db,
    sql: connection.sql,
    plan,
    secrets: config.secrets,
    onProgress,
    deadline,
    expectations,
  });

  await connection.sql.end({ timeout: 5 });

  console.log(
    `Demo seed (${config.profile}) succeeded in ${String(Math.ceil(result.elapsedMs / 1000))}s. ` +
      `Demo book reconciled; ${DEMO_NAMED_CUSTOMERS.idlePark.name} accounting showcase validated ` +
      `(Customers → Accounting tab).`,
  );
} catch (error) {
  if (
    error instanceof MissingDatabaseUrlError ||
    error instanceof Phase1SeedError ||
    error instanceof DemoSeedGuardError
  ) {
    console.error(error.message);
    process.exit(1);
  }
  if (error instanceof Error) {
    const detail =
      error.message.trim().length > 0
        ? error.message
        : error.cause instanceof Error && error.cause.message.trim().length > 0
          ? error.cause.message
          : `${error.name}: demo seed failed`;
    console.error(detail);
    process.exit(1);
  }
  throw error;
}
