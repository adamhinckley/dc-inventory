import type { DemoCounts, PersonaOrderBudgets } from "./constants.js";

export type PlannedProduct = {
  key: string;
  sku: string;
  name: string;
  uom: string;
  memberPriceCents: number;
  description: null;
  listPriceCents: number | null;
  currency: "USD";
  webWholesale: true;
  taxCategoryCode: "TANGIBLE";
  imageObjectKey: string;
  imageContentType: "image/jpeg";
  isPhase1Fixture: boolean;
};

export type PlannedSupplier = {
  key: string;
  vendorNumber: string;
  name: string;
};

export type PlannedSupplierProduct = {
  supplierKey: string;
  sku: string;
  minOrderQty: null;
};

export type PlannedShipTo = {
  key: string;
  customerKey: string;
  line1: string;
  line2: null;
  city: string;
  region: string;
  postal: string;
  country: "US";
  isDefault: true;
};

export type PlannedCustomer = {
  key: string;
  name: string;
  creditLimitCents: number;
  currency: "USD";
  terms: "Net 30";
  persona: "acme" | "northstar" | "harvest" | "idlePark" | "mix";
  shipToKey: string;
  hasExemptionCertificate: boolean;
};

export type PlannedPurchaseOrderLine = {
  sku: string;
  qty: number;
};

export type PlannedPurchaseOrder = {
  key: string;
  supplierKey: string;
  plannedInstant: Date;
  status: "received" | "leftoverConfirmed";
  lines: PlannedPurchaseOrderLine[];
};

export type PlannedSalesOrderLine = {
  sku: string;
  qty: number;
  unitPriceCents: number;
};

export type PlannedSalesOrder = {
  key: string;
  customerKey: string;
  plannedInstant: Date;
  status: "shipped" | "leftoverConfirmed" | "leftoverDraft";
  shipTo: Omit<PlannedShipTo, "key" | "customerKey">;
  lines: PlannedSalesOrderLine[];
};

export type PlannedShippedInvoice = {
  key: string;
  salesOrderKey: string;
  customerKey: string;
  plannedInstant: Date;
  subtotalCents: number;
  paid: boolean;
  replaySequence: number;
};

export type DemoBookPlan = {
  seed: string;
  seedToday: Date;
  historicalStart: Date;
  master: {
    products: PlannedProduct[];
    suppliers: PlannedSupplier[];
    supplierProducts: PlannedSupplierProduct[];
    customers: PlannedCustomer[];
    shipTos: PlannedShipTo[];
    staffEmail: string;
    wholesaleEmail: string;
    wholesaleCustomerKey: "acme";
  };
  purchaseOrders: PlannedPurchaseOrder[];
  salesOrders: PlannedSalesOrder[];
  shippedInvoices: PlannedShippedInvoice[];
  leftoverConfirmedPurchaseOrderCount: number;
  leftoverConfirmedSalesOrderCount: number;
};

export type PlanDemoBookInput = {
  seed?: string;
  seedToday: Date;
};

export type ReplayComparablePlan = Omit<
  DemoBookPlan,
  "seedToday" | "historicalStart" | "purchaseOrders" | "salesOrders" | "shippedInvoices"
> & {
  purchaseOrders: Array<
    Omit<PlannedPurchaseOrder, "plannedInstant"> & { plannedInstant: null }
  >;
  salesOrders: Array<Omit<PlannedSalesOrder, "plannedInstant"> & { plannedInstant: null }>;
  shippedInvoices: Array<
    Omit<PlannedShippedInvoice, "plannedInstant"> & { plannedInstant: null }
  >;
};
