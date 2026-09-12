import type { FastifyInstance } from "fastify";
import { registerStaffAudienceGuard } from "../adapters/http/audience-guard.js";
import { registerFeatureGuard } from "../adapters/http/feature-guard.js";
import { registerInternalAuthRoutes } from "../adapters/http/internal-auth.js";
import { registerInternalCustomerRoutes } from "../adapters/http/internal-customers.js";
import { registerInternalAccountingRoutes } from "../adapters/http/internal-accounting.js";
import { registerInternalInvoiceRoutes } from "../adapters/http/internal-invoices.js";
import { registerInternalLicensingRoutes } from "../adapters/http/internal-licensing.js";
import { registerInternalOrganizationRoutes } from "../adapters/http/internal-organizations.js";
import { registerInternalPurchaseOrderRoutes } from "../adapters/http/internal-purchase-orders.js";
import { registerInternalSalesOrderRoutes } from "../adapters/http/internal-sales-orders.js";
import { registerInternalSupplierProductRoutes } from "../adapters/http/internal-supplier-products.js";
import { registerInternalSupplierRoutes } from "../adapters/http/internal-suppliers.js";
import {
  registerInternalProductWriteRoutes,
  registerInternalProductStockRoutes,
} from "../adapters/http/internal-products.js";
import {
  registerInternalInventoryRoutes,
  registerInternalPreOrderSkusDraftPurchaseOrderRoutes,
  registerInternalPreOrderSkusListRoutes,
} from "../adapters/http/internal-inventory.js";
import { registerStaffActionGuard } from "../adapters/http/staff-action-guard.js";

/** Staff mount (`/internal`). Auth, customers, catalog products, purchasing, and sales. */
export async function internalRoutes(app: FastifyInstance): Promise<void> {
  registerInternalAuthRoutes(app);
  registerStaffAudienceGuard(app);
  registerStaffActionGuard(app);
  registerInternalOrganizationRoutes(app);
  await app.register(async (customers) => {
    registerFeatureGuard(customers, "customers", "staff");
    registerInternalCustomerRoutes(customers);
  });
  await app.register(async (inventoryReads) => {
    registerFeatureGuard(inventoryReads, "inventory", "staff");
    registerInternalPreOrderSkusListRoutes(inventoryReads);
  });
  await app.register(async (catalog) => {
    registerFeatureGuard(catalog, "catalog", "staff");
    registerInternalProductWriteRoutes(catalog);
    await catalog.register(async (inventory) => {
      registerFeatureGuard(inventory, "inventory", "staff");
      registerInternalProductStockRoutes(inventory);
      registerInternalInventoryRoutes(inventory);
    });
  });
  await app.register(async (purchasing) => {
    registerFeatureGuard(purchasing, "purchasing", "staff");
    registerInternalPurchaseOrderRoutes(purchasing);
    registerInternalPreOrderSkusDraftPurchaseOrderRoutes(purchasing);
    registerInternalSupplierRoutes(purchasing);
    registerInternalSupplierProductRoutes(purchasing);
  });
  await app.register(async (sales) => {
    registerFeatureGuard(sales, "sales", "staff");
    registerInternalSalesOrderRoutes(sales);
  });
  await app.register(async (accounting) => {
    registerFeatureGuard(accounting, "ar", "staff");
    registerInternalInvoiceRoutes(accounting);
    registerInternalAccountingRoutes(accounting);
  });
  registerInternalLicensingRoutes(app);
}
