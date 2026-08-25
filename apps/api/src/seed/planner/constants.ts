import { FULL_DEMO_RECONCILIATION_EXPECTATIONS } from "../reconciliation/expectations.js";

export const DEFAULT_DEMO_SEED = "dc-inventory-demo-1";

export const DEMO_HISTORY_YEARS = 5;

export const GENERATED_SKU_PREFIX = "DEM-";
export const GENERATED_SKU_COUNT = 795;
export const GENERATED_SKU_FIRST = 1;
export const GENERATED_SKU_LAST = 795;

export const MEMBER_PRICE_MIN_CENTS = 25;
export const MEMBER_PRICE_MAX_CENTS = 2_500;

export const PO_LINE_COUNT_MIN = 4;
export const PO_LINE_COUNT_MAX = 12;
export const PO_LINE_COUNT_MEAN = 8;

export const PO_LINE_QTY_MIN = 6;
export const PO_LINE_QTY_MAX = 24;
export const PO_LINE_QTY_MEAN = 12;

export const SO_LINE_COUNT_DEFAULT_MIN = 1;
export const SO_LINE_COUNT_DEFAULT_MAX = 6;
export const SO_LINE_COUNT_DEFAULT_MEAN = 3;

export const SO_LINE_COUNT_NORTHSTAR_MIN = 4;
export const SO_LINE_COUNT_NORTHSTAR_MAX = 6;

export const SO_LINE_COUNT_IDLE_PARK_MIN = 1;
export const SO_LINE_COUNT_IDLE_PARK_MAX = 2;

export const SO_LINE_QTY_MIN = 1;
export const SO_LINE_QTY_MAX = 6;
export const SO_LINE_QTY_MEAN = 3;

export const PERSONA_ORDER_BUDGETS = {
  northstar: 1_500,
  harvest: 450,
  idlePark: 75,
} as const;

export const IDLE_PARK_DORMANCY_DAYS = 120;

export const HARVEST_Q4_SHIPPED_FRACTION = 0.7;

export const Q4_MONTH_WEIGHT = 1.4;
export const BASE_MONTH_WEIGHT = 1.0;

export const EXEMPTION_CUSTOMER_FRACTION = 4 / 5;

export const SUPPLIER_SKU_TARGET = Math.floor(
  FULL_DEMO_RECONCILIATION_EXPECTATIONS.productCount /
    FULL_DEMO_RECONCILIATION_EXPECTATIONS.supplierCount,
);

export const DEMO_COUNTS = {
  products: FULL_DEMO_RECONCILIATION_EXPECTATIONS.productCount,
  suppliers: FULL_DEMO_RECONCILIATION_EXPECTATIONS.supplierCount,
  customers: FULL_DEMO_RECONCILIATION_EXPECTATIONS.customerCount,
  mixCustomers:
    FULL_DEMO_RECONCILIATION_EXPECTATIONS.customerCount -
    4 /* named */,
  purchaseOrders: FULL_DEMO_RECONCILIATION_EXPECTATIONS.purchaseOrderCount,
  salesOrders: FULL_DEMO_RECONCILIATION_EXPECTATIONS.salesOrderCount,
  shippedSalesOrders: FULL_DEMO_RECONCILIATION_EXPECTATIONS.shippedSalesOrderCount,
  invoices: FULL_DEMO_RECONCILIATION_EXPECTATIONS.invoiceCount,
  payments: FULL_DEMO_RECONCILIATION_EXPECTATIONS.paymentCount,
  unpaidInvoices: FULL_DEMO_RECONCILIATION_EXPECTATIONS.unpaidInvoiceCount,
  mixUnpaidInvoices:
    FULL_DEMO_RECONCILIATION_EXPECTATIONS.unpaidInvoiceCount -
    PERSONA_ORDER_BUDGETS.idlePark,
} as const;
