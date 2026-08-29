/**
 * Drizzle table models — one Postgres schema per bounded context.
 * Kit home stays in the API app. ADA-52 catalog / purchasing / inventory.
 * ADA-53 identity / customers / sales / tax / accounting.
 * ADA-54 licensing / operator_bridge.
 */
export {
  catalog,
  categories,
  identifierKind,
  productCategories,
  productIdentifiers,
  productImages,
  productPackaging,
  products,
} from "@dc-inventory/catalog/schema";
export {
  purchaseOrderLines,
  purchaseOrders,
  purchasing,
  supplierProducts,
  suppliers,
} from "@dc-inventory/purchasing/schema";
export {
  inventory,
  locations,
  movementRefType,
  movementType,
  reorderPolicies,
  stockMovements,
  stockSnapshots,
} from "@dc-inventory/inventory/schema";
export {
  actorType,
  identity,
  opsUserKind,
  opsUsers,
  organizations,
  sessions,
  staffUsers,
  wholesaleUsers,
} from "@dc-inventory/identity/schema";
export {
  contacts,
  customers,
  customersSchema,
  exemptionCertificates,
  shipTos,
} from "@dc-inventory/customers/schema";
export { orderLines, orders, orderStatus, sales } from "@dc-inventory/sales/schema";
export {
  tax,
  taxCommitLines,
  taxCommits,
  taxCommitStatus,
} from "./schema/tax.js";
export {
  accounting,
  invoiceStatus,
  invoices,
  invoiceTaxLines,
  paymentApplications,
  payments,
} from "@dc-inventory/accounting/schema";
export {
  addOnGrantSource,
  addOnGrants,
  flagOverrideDirection,
  flagOverrides,
  licensing,
  softwarePaymentKind,
  softwarePaymentProvider,
  softwarePayments,
  softwarePaymentStatus,
  subscriptionStatus,
  subscriptions,
} from "@dc-inventory/licensing/schema";
export {
  issueActorType,
  issueReports,
  issueReportStatus,
  issueSurface,
  operatorBridge,
  operatorOutbox,
  operatorOutboxKind,
} from "./schema/operator-bridge.js";

import {
  categories,
  productCategories,
  productIdentifiers,
  productImages,
  productPackaging,
  products,
} from "@dc-inventory/catalog/schema";
import {
  purchaseOrderLines,
  purchaseOrders,
  supplierProducts,
  suppliers,
} from "@dc-inventory/purchasing/schema";
import {
  locations,
  reorderPolicies,
  stockMovements,
  stockSnapshots,
} from "@dc-inventory/inventory/schema";
import {
  opsUsers,
  organizations,
  sessions,
  staffUsers,
  wholesaleUsers,
} from "@dc-inventory/identity/schema";
import {
  contacts,
  customers,
  exemptionCertificates,
  shipTos,
} from "@dc-inventory/customers/schema";
import { orderLines, orders } from "@dc-inventory/sales/schema";
import { taxCommitLines, taxCommits } from "./schema/tax.js";
import {
  invoices,
  invoiceTaxLines,
  paymentApplications,
  payments,
} from "@dc-inventory/accounting/schema";
import {
  addOnGrants,
  flagOverrides,
  softwarePayments,
  subscriptions,
} from "@dc-inventory/licensing/schema";
import { issueReports, operatorOutbox } from "./schema/operator-bridge.js";

export const schema = {
  products,
  productIdentifiers,
  productPackaging,
  categories,
  productCategories,
  productImages,
  suppliers,
  supplierProducts,
  purchaseOrders,
  purchaseOrderLines,
  locations,
  reorderPolicies,
  stockMovements,
  stockSnapshots,
  opsUsers,
  organizations,
  staffUsers,
  wholesaleUsers,
  sessions,
  customers,
  contacts,
  shipTos,
  exemptionCertificates,
  orders,
  orderLines,
  taxCommits,
  taxCommitLines,
  invoices,
  invoiceTaxLines,
  payments,
  paymentApplications,
  subscriptions,
  addOnGrants,
  flagOverrides,
  softwarePayments,
  issueReports,
  operatorOutbox,
};
