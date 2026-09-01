export type DemoProductRow = {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  uom: string;
  memberPriceCents: number;
  listPriceCents: number | null;
  currency: string;
  webWholesale: boolean;
  taxCategoryCode: string | null;
};

export type DemoImageRow = {
  productId: string;
  sku: string;
  objectKey: string;
  contentType: string | null;
};

export type DemoSupplierRow = {
  id: string;
  vendorNumber: string;
  name: string;
};

export type DemoSupplierProductRow = {
  supplierId: string;
  sku: string;
  minOrderQty: number | null;
};

export type DemoCustomerRow = {
  id: string;
  name: string;
  creditLimitCents: number;
  currency: string;
  terms: string;
};

export type DemoShipToRow = {
  id: string;
  customerId: string;
  line1: string;
  line2: string | null;
  city: string;
  region: string;
  postal: string;
  country: string;
  isDefault: boolean;
};

export type DemoContactRow = {
  customerId: string;
  name: string;
  email: string;
};

export type DemoExemptionRow = {
  customerId: string;
  objectKey: string | null;
  jurisdiction: string;
  entityUseCode: string | null;
  expiresAt: Date | null;
  status: string;
};

export type DemoStaffUserRow = {
  id: string;
  email: string;
};

export type DemoWholesaleUserRow = {
  id: string;
  email: string;
  customerId: string;
};

export type DemoOpsUserRow = {
  id: string;
  email: string;
};

export type DemoPurchaseOrderRow = {
  id: string;
  supplierId: string;
  status: "draft" | "confirmed" | "received" | "cancelled";
  documentNumber: string;
  createdAt: Date;
};

export type DemoPurchaseOrderLineRow = {
  purchaseOrderId: string;
  sku: string;
  qty: number;
  receivedQty: number;
};

export type DemoSalesOrderRow = {
  id: string;
  customerId: string;
  status: "draft" | "confirmed" | "shipped" | "cancelled";
  documentNumber: string;
  createdAt: Date;
  shipLine1: string | null;
  shipLine2: string | null;
  shipCity: string | null;
  shipRegion: string | null;
  shipPostal: string | null;
  shipCountry: string | null;
};

export type DemoSalesOrderLineRow = {
  orderId: string;
  sku: string;
  qty: number;
  unitPriceCents: number;
};

export type DemoInvoiceRow = {
  id: string;
  orderId: string;
  customerId: string;
  documentNumber: string;
  postedAt: Date | null;
  subtotalCents: number;
  taxTotalCents: number;
  totalCents: number;
};

export type DemoInvoiceTaxLineRow = {
  invoiceId: string;
};

export type DemoPaymentRow = {
  id: string;
  customerId: string;
  amountCents: number;
};

export type DemoPaymentApplicationRow = {
  paymentId: string;
  invoiceId: string;
  amountCents: number;
};

export type DemoTaxCommitRow = {
  id: string;
  invoiceId: string | null;
  organizationId: string;
};

export type DemoMovementType =
  | "InboundFromPo"
  | "GoodsReceived"
  | "InboundCancelled"
  | "Allocated"
  | "Deallocated"
  | "Shipped"
  | "Committed"
  | "Decommitted"
  | "AdjustmentIncrease"
  | "AdjustmentDecrease";

export type DemoMovementRow = {
  sku: string;
  locationId: string;
  movementType: DemoMovementType;
  quantity: number;
  createdAt: Date;
};

export type DemoSnapshotRow = {
  sku: string;
  locationId: string;
  onHand: number;
  onOrder: number;
  allocated: number;
};

export type DemoReorderPolicyRow = {
  sku: string;
  locationId: string;
  minOnHand: number;
  maxOnHand: number;
};

export type DemoBook = {
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

export interface IDemoBookReader {
  load(): Promise<DemoBook>;
}
