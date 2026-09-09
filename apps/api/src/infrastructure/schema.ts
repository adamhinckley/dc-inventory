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
  supplierPoDocumentNumberCounters,
  supplierProducts,
  suppliers,
} from "@dc-inventory/purchasing/schema";
export {
  inventory,
  locations,
  movementRefType,
  movementType,
  reorderPolicies,
  sellWindowSkus,
  sellWindows,
  sellWindowStatus,
  stockMovements,
  stockSnapshots,
} from "@dc-inventory/inventory/schema";
export {
  actorType,
  identity,
  loginThrottleCounters,
  opsUserKind,
  opsUsers,
  organizations,
  sessions,
  staffUsers,
  wholesaleUsers,
} from "@dc-inventory/identity/schema";
export {
  billTos,
  contacts,
  customers,
  customersSchema,
  documentNumberCounters as customersDocumentNumberCounters,
  exemptionCertificates,
  shipTos,
} from "@dc-inventory/customers/schema";
export {
  documentNumberCounters as salesDocumentNumberCounters,
  orderLines,
  orders,
  orderStatus,
  sales,
} from "@dc-inventory/sales/schema";
export {
  tax,
  taxCommitLines,
  taxCommits,
  taxCommitStatus,
} from "./schema/tax.js";
export {
  accounting,
  documentNumberCounters as accountingDocumentNumberCounters,
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
  supplierPoDocumentNumberCounters,
  supplierProducts,
  suppliers,
} from "@dc-inventory/purchasing/schema";
import {
  locations,
  reorderPolicies,
  sellWindowSkus,
  sellWindows,
  stockMovements,
  stockSnapshots,
} from "@dc-inventory/inventory/schema";
import {
  loginThrottleCounters,
  opsUsers,
  organizations,
  sessions,
  staffUsers,
  wholesaleUsers,
} from "@dc-inventory/identity/schema";
import {
  billTos,
  contacts,
  customers,
  documentNumberCounters as customersDocumentNumberCounters,
  exemptionCertificates,
  shipTos,
} from "@dc-inventory/customers/schema";
import {
  documentNumberCounters as salesDocumentNumberCounters,
  orderLines,
  orders,
} from "@dc-inventory/sales/schema";
import { taxCommitLines, taxCommits } from "./schema/tax.js";
import {
  documentNumberCounters as accountingDocumentNumberCounters,
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
  supplierPoDocumentNumberCounters,
  purchaseOrders,
  purchaseOrderLines,
  locations,
  reorderPolicies,
  sellWindowSkus,
  sellWindows,
  stockMovements,
  stockSnapshots,
  loginThrottleCounters,
  opsUsers,
  organizations,
  staffUsers,
  wholesaleUsers,
  sessions,
  customers,
  contacts,
  shipTos,
  billTos,
  customersDocumentNumberCounters,
  exemptionCertificates,
  orders,
  orderLines,
  salesDocumentNumberCounters,
  taxCommits,
  taxCommitLines,
  invoices,
  accountingDocumentNumberCounters,
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
