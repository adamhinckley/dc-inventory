import type { FastifyInstance } from "fastify";
import { registerStaffAudienceGuard } from "../adapters/http/audience-guard.js";
import { registerInternalAuthRoutes } from "../adapters/http/internal-auth.js";
import { registerInternalCustomerRoutes } from "../adapters/http/internal-customers.js";
import { registerInternalProductRoutes } from "../adapters/http/internal-products.js";

/** Staff mount (`/internal`). Auth, customers, and catalog products. */
export async function internalRoutes(app: FastifyInstance): Promise<void> {
  registerInternalAuthRoutes(app);
  registerStaffAudienceGuard(app);
  registerInternalCustomerRoutes(app);
  registerInternalProductRoutes(app);
}
