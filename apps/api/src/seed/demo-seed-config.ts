import { readDatabaseUrl } from "../infrastructure/database-url.js";
import { DEFAULT_DEMO_SEED } from "./planner/constants.js";
import { Phase1SeedError } from "./run-phase1-seed.js";

export const DEMO_SEED_TIME_LIMIT_MS = 30 * 60 * 1000;

export const DEMO_SEED_PROFILES = ["full", "reduced"] as const;
export type DemoSeedProfile = (typeof DEMO_SEED_PROFILES)[number];

export type DemoSeedSecrets = {
  staffPassword: string;
  wholesalePassword: string;
  platformPassword: string;
};

export type DemoSeedConfig = {
  databaseUrl: string;
  seed: string;
  profile: DemoSeedProfile;
  resetOptIn: string | undefined;
  secrets: DemoSeedSecrets;
};

function parseDemoSeedProfile(raw: string | undefined): DemoSeedProfile {
  const profile = raw?.trim().toLowerCase() ?? "reduced";
  if (profile === "full" || profile === "reduced") {
    return profile;
  }
  throw new Phase1SeedError(
    `DEMO_SEED_PROFILE must be "full" or "reduced" (got "${raw ?? ""}").`,
  );
}

function readSecret(
  env: NodeJS.ProcessEnv,
  name: "PHASE1_STAFF_PASSWORD" | "PHASE1_WHOLESALE_PASSWORD" | "PHASE1_PLATFORM_PASSWORD",
): string {
  const value = env[name]?.trim() ?? "";
  if (value.length === 0) {
    throw new Phase1SeedError(
      `${name} is missing. Copy the placeholder from apps/api/.env.example — do not commit a real secret.`,
    );
  }
  return value;
}

export function parseDemoSeedConfig(env: NodeJS.ProcessEnv = process.env): DemoSeedConfig {
  const seed = env.DEMO_SEED?.trim() || DEFAULT_DEMO_SEED;

  return {
    databaseUrl: readDatabaseUrl(env),
    seed,
    profile: parseDemoSeedProfile(env.DEMO_SEED_PROFILE),
    resetOptIn: env.DEMO_SEED_RESET,
    secrets: {
      staffPassword: readSecret(env, "PHASE1_STAFF_PASSWORD"),
      wholesalePassword: readSecret(env, "PHASE1_WHOLESALE_PASSWORD"),
      platformPassword: readSecret(env, "PHASE1_PLATFORM_PASSWORD"),
    },
  };
}
