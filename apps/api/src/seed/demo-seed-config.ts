import { DEFAULT_DEMO_SEED } from "./planner/constants.js";
import { Phase1SeedError } from "./run-phase1-seed.js";

export const DEMO_SEED_TIME_LIMIT_MS = 10 * 60 * 1000;

export type DemoSeedSecrets = {
  staffPassword: string;
  wholesalePassword: string;
};

export type DemoSeedConfig = {
  databaseUrl: string;
  seed: string;
  resetOptIn: string | undefined;
  secrets: DemoSeedSecrets;
};

function readSecret(name: "PHASE1_STAFF_PASSWORD" | "PHASE1_WHOLESALE_PASSWORD"): string {
  const value = process.env[name]?.trim() ?? "";
  if (value.length === 0) {
    throw new Phase1SeedError(
      `${name} is missing. Copy the placeholder from apps/api/.env.example — do not commit a real secret.`,
    );
  }
  return value;
}

export function parseDemoSeedConfig(env: NodeJS.ProcessEnv = process.env): DemoSeedConfig {
  const databaseUrl = env.DATABASE_URL?.trim() ?? "";
  const seed = env.DEMO_SEED?.trim() || DEFAULT_DEMO_SEED;

  return {
    databaseUrl,
    seed,
    resetOptIn: env.DEMO_SEED_RESET,
    secrets: {
      staffPassword: readSecret("PHASE1_STAFF_PASSWORD"),
      wholesalePassword: readSecret("PHASE1_WHOLESALE_PASSWORD"),
    },
  };
}
