import {
  PHASE1_CUSTOMER_CREDIT_LIMIT_CENTS,
  PHASE1_CUSTOMER_CURRENCY,
  PHASE1_CUSTOMER_NAME,
  PHASE1_CUSTOMER_TERMS,
} from "../phase1-fixture.js";

export type DemoArBucket = "current" | "30_59" | "60_89" | "90_plus";

export const DEMO_AR_BUCKETS: readonly DemoArBucket[] = [
  "current",
  "30_59",
  "60_89",
  "90_plus",
];

export type DemoNamedCustomerPin = {
  name: string;
  creditLimitCents: number;
  ship: {
    line1: string;
    city: string;
    region: string;
    postal: string;
  };
};

export const DEMO_NAMED_CUSTOMERS = {
  acme: {
    name: PHASE1_CUSTOMER_NAME,
    creditLimitCents: PHASE1_CUSTOMER_CREDIT_LIMIT_CENTS,
    ship: {
      line1: "100 Warehouse Rd",
      city: "Ogden",
      region: "UT",
      postal: "84401",
    },
  },
  northstar: {
    name: "Northstar Big Box",
    creditLimitCents: 10_000_000,
    ship: {
      line1: "5000 Retail Pkwy",
      city: "Minneapolis",
      region: "MN",
      postal: "55401",
    },
  },
  harvest: {
    name: "Harvest Seasonal Co.",
    creditLimitCents: 2_000_000,
    ship: {
      line1: "80 Orchard Ln",
      city: "Yakima",
      region: "WA",
      postal: "98901",
    },
  },
  idlePark: {
    name: "Idle Park Distributors",
    creditLimitCents: 250_000,
    ship: {
      line1: "12 Quiet Ct",
      city: "Duluth",
      region: "MN",
      postal: "55802",
    },
  },
} as const satisfies Record<string, DemoNamedCustomerPin>;

export type DemoReconciliationExpectations = {
  productCount: number;
  supplierCount: number;
  customerCount: number;
  purchaseOrderCount: number;
  salesOrderCount: number;
  invoiceCount: number;
  paymentCount: number;
  imageCount: number;
  supplierProductCount: number;
  reorderPolicyCount: number;
  shippedSalesOrderCount: number;
  unpaidInvoiceCount: number;
  leftoverConfirmedSalesOrderMin: number;
  leftoverConfirmedSalesOrderMax: number;
  leftoverConfirmedPurchaseOrderMin: number;
  leftoverConfirmedPurchaseOrderMax: number;
  leftoverWindowDays: number;
  lowStockMin: number;
  lowStockMax: number;
  exemptionCertificateCount: number;
  supplierSkuMin: number;
  supplierSkuMax: number;
  mixCustomerCreditLimitCents: number;
  customerTerms: string;
  customerCurrency: string;
};

export const FULL_DEMO_RECONCILIATION_EXPECTATIONS: DemoReconciliationExpectations = {
  productCount: 800,
  supplierCount: 25,
  customerCount: 60,
  purchaseOrderCount: 3_000,
  salesOrderCount: 15_000,
  invoiceCount: 12_000,
  paymentCount: 8_000,
  imageCount: 800,
  supplierProductCount: 800,
  reorderPolicyCount: 800,
  shippedSalesOrderCount: 12_000,
  unpaidInvoiceCount: 4_000,
  leftoverConfirmedSalesOrderMin: 20,
  leftoverConfirmedSalesOrderMax: 50,
  leftoverConfirmedPurchaseOrderMin: 8,
  leftoverConfirmedPurchaseOrderMax: 20,
  leftoverWindowDays: 7,
  lowStockMin: 40,
  lowStockMax: 80,
  exemptionCertificateCount: 48,
  supplierSkuMin: 24,
  supplierSkuMax: 40,
  mixCustomerCreditLimitCents: 1_000_000,
  customerTerms: PHASE1_CUSTOMER_TERMS,
  customerCurrency: PHASE1_CUSTOMER_CURRENCY,
};
