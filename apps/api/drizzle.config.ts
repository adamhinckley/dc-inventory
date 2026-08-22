import { defineConfig } from "drizzle-kit";

/**
 * Migration output only — no Catalog/Inventory tables in ADA-34.
 * Agents add context schemas in later tickets, not here.
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
