import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "drizzle-kit";

const here = dirname(fileURLToPath(import.meta.url));
const localEnv = resolve(here, ".env");
if (!process.env.DATABASE_URL?.trim() && existsSync(localEnv)) {
  process.loadEnvFile(localEnv);
}

/**
 * One Kit home: this file and `out` stay in the API app.
 * No packages/db. No second drizzle.config. Empty history until later schema tickets.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/infrastructure/schema.ts",
  out: "./drizzle/migrations",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ?? "postgres://localhost:5432/dc_inventory",
  },
});
