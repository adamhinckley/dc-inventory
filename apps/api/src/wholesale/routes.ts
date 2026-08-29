import type { FastifyInstance } from "fastify";
import { registerWholesaleAudienceGuard } from "../adapters/http/audience-guard.js";
import { registerFeatureGuard } from "../adapters/http/feature-guard.js";
import { registerWholesaleAuthRoutes } from "../adapters/http/wholesale-auth.js";
import { registerWholesaleCatalogRoutes } from "../adapters/http/wholesale-catalog.js";

/** Wholesale-client mount (`/wholesale`). Auth plus shop catalog list. */
export async function wholesaleRoutes(app: FastifyInstance): Promise<void> {
  registerWholesaleAuthRoutes(app);
  registerWholesaleAudienceGuard(app);
  await app.register(async (catalog) => {
    registerFeatureGuard(catalog, "catalog", "wholesale");
    registerWholesaleCatalogRoutes(catalog);
  });
}
