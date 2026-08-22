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
} from "./schema/catalog.js";
export {
  purchaseOrderLines,
  purchaseOrders,
  purchasing,
  supplierProducts,
  suppliers,
} from "./schema/purchasing.js";
export {
  inventory,
  locations,
  movementRefType,
  movementType,
  reorderPolicies,
  stockMovements,
  stockSnapshots,
} from "./schema/inventory.js";
export {
  actorType,
  identity,
  opsUserKind,
  opsUsers,
  sessions,
  staffUsers,
  wholesaleUsers,
} from "./schema/identity.js";
export {
  contacts,
  customers,
  customersSchema,
  exemptionCertificates,
  shipTos,
} from "./schema/customers.js";
export { orderLines, orders, orderStatus, sales } from "./schema/sales.js";
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
} from "./schema/accounting.js";
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
} from "./schema/licensing.js";
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
} from "./schema/catalog.js";
import {
  purchaseOrderLines,
  purchaseOrders,
  supplierProducts,
  suppliers,
} from "./schema/purchasing.js";
import {
  locations,
  reorderPolicies,
  stockMovements,
  stockSnapshots,
} from "./schema/inventory.js";
import {
  opsUsers,
  sessions,
  staffUsers,
  wholesaleUsers,
} from "./schema/identity.js";
import {
  contacts,
  customers,
  exemptionCertificates,
  shipTos,
} from "./schema/customers.js";
import { orderLines, orders } from "./schema/sales.js";
import { taxCommitLines, taxCommits } from "./schema/tax.js";
import {
  invoices,
  invoiceTaxLines,
  paymentApplications,
  payments,
} from "./schema/accounting.js";
import {
  addOnGrants,
  flagOverrides,
  softwarePayments,
  subscriptions,
} from "./schema/licensing.js";
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
