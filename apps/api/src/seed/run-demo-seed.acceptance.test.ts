import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseDemoSeedConfig } from "./demo-seed-config.js";
import { DEMO_SEED_TIME_LIMIT_MS } from "./demo-seed-config.js";
import { createDatabaseConnection } from "../infrastructure/db.js";
import {
  assertDemoSeedPreflight,
  PostgresDemoBookOccupancy,
  PostgresDemoBookReset,
} from "./guard/index.js";
import { planDemoBook } from "./planner/plan-demo-book.js";
import { DEFAULT_DEMO_SEED } from "./planner/constants.js";
import { runDemoSeedOnDb } from "./run-demo-seed-on-db.js";

const acceptanceEnabled = process.env.DEMO_SEED_ACCEPTANCE === "1";
const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";

describe.skipIf(!acceptanceEnabled || !databaseUrl)(
  "runDemoSeedOnDb acceptance (opt-in Postgres)",
  () => {
    it(
      "migrates, seeds, resets, replays, and reconciles the full bench under the time budget",
      async () => {
        const config = parseDemoSeedConfig({
          ...process.env,
          DATABASE_URL: databaseUrl,
          DEMO_SEED: process.env.DEMO_SEED?.trim() || DEFAULT_DEMO_SEED,
          DEMO_SEED_RESET: "1",
          PHASE1_STAFF_PASSWORD:
            process.env.PHASE1_STAFF_PASSWORD?.trim() || "phase1-staff-placeholder",
          PHASE1_WHOLESALE_PASSWORD:
            process.env.PHASE1_WHOLESALE_PASSWORD?.trim() || "phase1-wholesale-placeholder",
        });

        const startedAt = Date.now();
        const connection = createDatabaseConnection(config.databaseUrl);

        await assertDemoSeedPreflight({
          databaseUrl: config.databaseUrl,
          resetOptIn: config.resetOptIn,
          occupancy: new PostgresDemoBookOccupancy(connection.sql),
          reset: new PostgresDemoBookReset(connection.sql),
        });

        const seedToday = new Date();
        const plan = planDemoBook({ seed: config.seed, seedToday });

        const first = await runDemoSeedOnDb({
          db: connection.db,
          sql: connection.sql,
          plan,
          secrets: config.secrets,
        });
        expect(first.reconciliation.ok).toBe(true);

        await assertDemoSeedPreflight({
          databaseUrl: config.databaseUrl,
          resetOptIn: "1",
          occupancy: new PostgresDemoBookOccupancy(connection.sql),
          reset: new PostgresDemoBookReset(connection.sql),
        });

        const replay = await runDemoSeedOnDb({
          db: connection.db,
          sql: connection.sql,
          plan: planDemoBook({ seed: config.seed, seedToday: new Date() }),
          secrets: config.secrets,
        });
        expect(replay.reconciliation.ok).toBe(true);

        await connection.sql.end({ timeout: 5 });

        const elapsed = Date.now() - startedAt;
        expect(elapsed).toBeLessThan(DEMO_SEED_TIME_LIMIT_MS);
      },
      DEMO_SEED_TIME_LIMIT_MS + 60_000,
    );
  },
);

describe("seed:demo contract", () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

  it("documents root and API scripts without invoking Phase 1 seed", () => {
    const rootPkg = JSON.parse(
      readFileSync(resolve(root, "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    const apiPkg = JSON.parse(
      readFileSync(resolve(root, "apps/api/package.json"), "utf8"),
    ) as { scripts: Record<string, string> };

    expect(rootPkg.scripts["seed:demo"]).toBe("pnpm --filter @dc-inventory/api seed:demo");
    expect(apiPkg.scripts["seed:demo"]).toBe("tsx src/seed/run-demo-seed-cli.ts");
    expect(apiPkg.scripts["seed:demo"]).not.toMatch(/phase1|db:seed:phase1/i);

    const cli = readFileSync(resolve(root, "apps/api/src/seed/run-demo-seed-cli.ts"), "utf8");
    expect(cli).not.toMatch(/runPhase1Seed|db:seed:phase1|cli\.ts/);
    expect(cli).toMatch(/runDemoSeedOnDb/);
    expect(cli).toMatch(/planDemoBook/);
  });

  it("keeps full bench out of default vitest include unless opted in", () => {
    const vitest = readFileSync(resolve(root, "vitest.config.ts"), "utf8");
    expect(vitest).not.toMatch(/DEMO_SEED_ACCEPTANCE/);
    expect(existsSync(resolve(root, "apps/api/src/seed/run-demo-seed.acceptance.test.ts"))).toBe(
      true,
    );
  });
});
