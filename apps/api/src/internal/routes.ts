import type { FastifyInstance } from "fastify";
import { registerStaffAudienceGuard } from "../adapters/http/audience-guard.js";
import { registerInternalAuthRoutes } from "../adapters/http/internal-auth.js";
import { registerInternalCustomerRoutes } from "../adapters/http/internal-customers.js";
import { registerInternalInvoiceRoutes } from "../adapters/http/internal-invoices.js";
import { registerInternalPurchaseOrderRoutes } from "../adapters/http/internal-purchase-orders.js";
import { registerInternalSupplierRoutes } from "../adapters/http/internal-suppliers.js";
import { registerInternalSalesOrderRoutes } from "../adapters/http/internal-sales-orders.js";
import { registerInternalProductRoutes } from "../adapters/http/internal-products.js";

/** Staff mount (`/internal`). Auth, customers, catalog products, purchasing, and sales. */
export async function internalRoutes(app: FastifyInstance): Promise<void> {
  registerInternalAuthRoutes(app);
  registerStaffAudienceGuard(app);
  registerInternalCustomerRoutes(app);
  registerInternalProductRoutes(app);
  registerInternalSupplierRoutes(app);
  registerInternalPurchaseOrderRoutes(app);
  registerInternalSalesOrderRoutes(app);
  registerInternalInvoiceRoutes(app);
}
