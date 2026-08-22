import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildApp } from "./app.js";
import { MissingDatabaseUrlError } from "./infrastructure/database-url.js";

function loadLocalEnvFile(): void {
  if (process.env.DATABASE_URL?.trim()) {
    return;
  }
  const envPath = resolve(dirname(fileURLToPath(import.meta.url)), "../.env");
  if (!existsSync(envPath)) {
    return;
  }
  process.loadEnvFile(envPath);
}

loadLocalEnvFile();

try {
  const app = await buildApp();
  const port = Number(process.env.PORT ?? 3001);
  await app.listen({ port, host: "0.0.0.0" });
} catch (error) {
  if (error instanceof MissingDatabaseUrlError) {
    console.error(error.message);
    process.exit(1);
  } else {
    throw error;
  }
}
