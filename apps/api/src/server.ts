import { buildApp } from "./app.js";
import { MissingDatabaseUrlError } from "./infrastructure/database-url.js";

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
