import type { FastifyInstance } from "fastify";
import { registerStaffAudienceGuard } from "../adapters/http/audience-guard.js";
import { registerInternalAuthRoutes } from "../adapters/http/internal-auth.js";
import { registerInternalCustomerRoutes } from "../adapters/http/internal-customers.js";
import { registerInternalInvoiceRoutes } from "../adapters/http/internal-invoices.js";
import { registerInternalLicensingRoutes } from "../adapters/http/internal-licensing.js";
import { registerInternalPurchaseOrderRoutes } from "../adapters/http/internal-purchase-orders.js";
import { registerInternalSalesOrderRoutes } from "../adapters/http/internal-sales-orders.js";
import { registerInternalSupplierProductRoutes } from "../adapters/http/internal-supplier-products.js";
import { registerInternalSupplierRoutes } from "../adapters/http/internal-suppliers.js";
import { registerInternalProductRoutes } from "../adapters/http/internal-products.js";
import { registerStaffActionGuard } from "../adapters/http/staff-action-guard.js";

/** Staff mount (`/internal`). Auth, customers, catalog products, purchasing, and sales. */
export async function internalRoutes(app: FastifyInstance): Promise<void> {
  registerInternalAuthRoutes(app);
  registerStaffAudienceGuard(app);
  registerStaffActionGuard(app);
  registerInternalCustomerRoutes(app);
  registerInternalProductRoutes(app);
  registerInternalPurchaseOrderRoutes(app);
  registerInternalSupplierRoutes(app);
  registerInternalSupplierProductRoutes(app);
  registerInternalSalesOrderRoutes(app);
  registerInternalInvoiceRoutes(app);
  registerInternalLicensingRoutes(app);
}
