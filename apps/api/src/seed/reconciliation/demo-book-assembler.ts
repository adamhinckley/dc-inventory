import type {
  DemoBook,
  DemoContactRow,
  DemoCustomerRow,
  DemoExemptionRow,
  DemoImageRow,
  DemoInvoiceRow,
  DemoInvoiceTaxLineRow,
  DemoMovementRow,
  DemoOpsUserRow,
  DemoPaymentApplicationRow,
  DemoPaymentRow,
  DemoProductRow,
  DemoPurchaseOrderLineRow,
  DemoPurchaseOrderRow,
  DemoReorderPolicyRow,
  DemoSalesOrderLineRow,
  DemoSalesOrderRow,
  DemoShipToRow,
  DemoSnapshotRow,
  DemoStaffUserRow,
  DemoSupplierProductRow,
  DemoSupplierRow,
  DemoTaxCommitRow,
  DemoWholesaleUserRow,
} from "./demo-book.js";

/** Row shapes returned from Postgres / Drizzle before assembly into a {@link DemoBook}. */
export type DemoBookRowBundle = {
  defaultLocationId: string;
  products: DemoProductRow[];
  images: DemoImageRow[];
  suppliers: DemoSupplierRow[];
  supplierProducts: DemoSupplierProductRow[];
  customers: DemoCustomerRow[];
  shipTos: DemoShipToRow[];
  contacts: DemoContactRow[];
  exemptionCertificates: DemoExemptionRow[];
  staffUsers: DemoStaffUserRow[];
  wholesaleUsers: DemoWholesaleUserRow[];
  opsUsers: DemoOpsUserRow[];
  purchaseOrders: DemoPurchaseOrderRow[];
  purchaseOrderLines: DemoPurchaseOrderLineRow[];
  salesOrders: DemoSalesOrderRow[];
  salesOrderLines: DemoSalesOrderLineRow[];
  invoices: DemoInvoiceRow[];
  invoiceTaxLines: DemoInvoiceTaxLineRow[];
  payments: DemoPaymentRow[];
  paymentApplications: DemoPaymentApplicationRow[];
  taxCommits: DemoTaxCommitRow[];
  movements: DemoMovementRow[];
  snapshots: DemoSnapshotRow[];
  reorderPolicies: DemoReorderPolicyRow[];
};

export function assembleDemoBook(bundle: DemoBookRowBundle): DemoBook {
  return {
    defaultLocationId: bundle.defaultLocationId,
    products: bundle.products,
    images: bundle.images,
    suppliers: bundle.suppliers,
    supplierProducts: bundle.supplierProducts,
    customers: bundle.customers,
    shipTos: bundle.shipTos,
    contacts: bundle.contacts,
    exemptionCertificates: bundle.exemptionCertificates,
    staffUsers: bundle.staffUsers,
    wholesaleUsers: bundle.wholesaleUsers,
    opsUsers: bundle.opsUsers,
    purchaseOrders: bundle.purchaseOrders,
    purchaseOrderLines: bundle.purchaseOrderLines,
    salesOrders: bundle.salesOrders,
    salesOrderLines: bundle.salesOrderLines,
    invoices: bundle.invoices,
    invoiceTaxLines: bundle.invoiceTaxLines,
    payments: bundle.payments,
    paymentApplications: bundle.paymentApplications,
    taxCommits: bundle.taxCommits,
    movements: bundle.movements,
    snapshots: bundle.snapshots,
    reorderPolicies: bundle.reorderPolicies,
  };
}

/** Test helper: flatten a {@link DemoBook} into the row bundle Postgres adapters assemble. */
export function demoBookToRowBundle(book: DemoBook): DemoBookRowBundle {
  return {
    defaultLocationId: book.defaultLocationId,
    products: structuredClone(book.products),
    images: structuredClone(book.images),
    suppliers: structuredClone(book.suppliers),
    supplierProducts: structuredClone(book.supplierProducts),
    customers: structuredClone(book.customers),
    shipTos: structuredClone(book.shipTos),
    contacts: structuredClone(book.contacts),
    exemptionCertificates: structuredClone(book.exemptionCertificates),
    staffUsers: structuredClone(book.staffUsers),
    wholesaleUsers: structuredClone(book.wholesaleUsers),
    opsUsers: structuredClone(book.opsUsers),
    purchaseOrders: structuredClone(book.purchaseOrders),
    purchaseOrderLines: structuredClone(book.purchaseOrderLines),
    salesOrders: structuredClone(book.salesOrders),
    salesOrderLines: structuredClone(book.salesOrderLines),
    invoices: structuredClone(book.invoices),
    invoiceTaxLines: structuredClone(book.invoiceTaxLines),
    payments: structuredClone(book.payments),
    paymentApplications: structuredClone(book.paymentApplications),
    taxCommits: structuredClone(book.taxCommits),
    movements: structuredClone(book.movements),
    snapshots: structuredClone(book.snapshots),
    reorderPolicies: structuredClone(book.reorderPolicies),
  };
}
