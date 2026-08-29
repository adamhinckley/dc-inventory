import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "drizzle-kit";
import { readDatabaseUrl } from "./src/infrastructure/database-url.js";

const here = dirname(fileURLToPath(import.meta.url));
const localEnv = resolve(here, ".env");
if (existsSync(localEnv)) {
  process.loadEnvFile(localEnv);
}

/**
 * One Kit home: this file and `out` stay in the API app.
 * No packages/db. No second drizzle.config. Additive Kit history lives in `out`.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/infrastructure/schema.ts",
  out: "./drizzle/migrations",
  dbCredentials: {
    url: readDatabaseUrl(),
  },
});
