import { FULL_DEMO_RECONCILIATION_EXPECTATIONS } from "../reconciliation/expectations.js";
import { REDUCED_DEMO_RECONCILIATION_EXPECTATIONS } from "../reconciliation/valid-reduced-demo-book.js";

export const DEFAULT_DEMO_SEED = "dc-inventory-demo-1";

export const DEMO_HISTORY_YEARS = 5;

export const GENERATED_SKU_PREFIX = "DEM-";
export const GENERATED_SKU_COUNT = 130;
export const GENERATED_SKU_FIRST = 1;
export const GENERATED_SKU_LAST = 130;

export const MASTER_PACK_PRICE_MIN_CENTS = 25;
export const MASTER_PACK_PRICE_MAX_CENTS = 2_500;

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
  northstar: 250,
  harvest: 75,
  idlePark: 13,
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

export type DemoCounts = {
  products: number;
  suppliers: number;
  customers: number;
  mixCustomers: number;
  purchaseOrders: number;
  salesOrders: number;
  shippedSalesOrders: number;
  invoices: number;
  payments: number;
  unpaidInvoices: number;
  mixUnpaidInvoices: number;
  generatedSkuCount: number;
  leftoverConfirmedPurchaseOrderMin: number;
  leftoverConfirmedPurchaseOrderMax: number;
  leftoverConfirmedSalesOrderMin: number;
  leftoverConfirmedSalesOrderMax: number;
  leftoverWindowDays: number;
};

export type PersonaOrderBudgets = {
  northstar: number;
  harvest: number;
  idlePark: number;
};

export const FULL_DEMO_COUNTS: DemoCounts = {
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
  generatedSkuCount: GENERATED_SKU_COUNT,
  leftoverConfirmedPurchaseOrderMin:
    FULL_DEMO_RECONCILIATION_EXPECTATIONS.leftoverConfirmedPurchaseOrderMin,
  leftoverConfirmedPurchaseOrderMax:
    FULL_DEMO_RECONCILIATION_EXPECTATIONS.leftoverConfirmedPurchaseOrderMax,
  leftoverConfirmedSalesOrderMin:
    FULL_DEMO_RECONCILIATION_EXPECTATIONS.leftoverConfirmedSalesOrderMin,
  leftoverConfirmedSalesOrderMax:
    FULL_DEMO_RECONCILIATION_EXPECTATIONS.leftoverConfirmedSalesOrderMax,
  leftoverWindowDays: FULL_DEMO_RECONCILIATION_EXPECTATIONS.leftoverWindowDays,
};

/** Test-only counts for in-memory orchestration. Not selectable from the CLI. */
export const REDUCED_DEMO_COUNTS: DemoCounts = {
  products: REDUCED_DEMO_RECONCILIATION_EXPECTATIONS.productCount,
  suppliers: REDUCED_DEMO_RECONCILIATION_EXPECTATIONS.supplierCount,
  customers: REDUCED_DEMO_RECONCILIATION_EXPECTATIONS.customerCount,
  mixCustomers: REDUCED_DEMO_RECONCILIATION_EXPECTATIONS.customerCount - 4,
  purchaseOrders: REDUCED_DEMO_RECONCILIATION_EXPECTATIONS.purchaseOrderCount,
  salesOrders: REDUCED_DEMO_RECONCILIATION_EXPECTATIONS.salesOrderCount,
  shippedSalesOrders: REDUCED_DEMO_RECONCILIATION_EXPECTATIONS.shippedSalesOrderCount,
  invoices: REDUCED_DEMO_RECONCILIATION_EXPECTATIONS.invoiceCount,
  payments: REDUCED_DEMO_RECONCILIATION_EXPECTATIONS.paymentCount,
  unpaidInvoices: REDUCED_DEMO_RECONCILIATION_EXPECTATIONS.unpaidInvoiceCount,
  mixUnpaidInvoices: 1,
  generatedSkuCount: 3,
  leftoverConfirmedPurchaseOrderMin:
    REDUCED_DEMO_RECONCILIATION_EXPECTATIONS.leftoverConfirmedPurchaseOrderMin,
  leftoverConfirmedPurchaseOrderMax:
    REDUCED_DEMO_RECONCILIATION_EXPECTATIONS.leftoverConfirmedPurchaseOrderMax,
  leftoverConfirmedSalesOrderMin:
    REDUCED_DEMO_RECONCILIATION_EXPECTATIONS.leftoverConfirmedSalesOrderMin,
  leftoverConfirmedSalesOrderMax:
    REDUCED_DEMO_RECONCILIATION_EXPECTATIONS.leftoverConfirmedSalesOrderMax,
  leftoverWindowDays: REDUCED_DEMO_RECONCILIATION_EXPECTATIONS.leftoverWindowDays,
};

export const REDUCED_PERSONA_ORDER_BUDGETS: PersonaOrderBudgets = {
  northstar: 3,
  harvest: 2,
  idlePark: 4,
};

export const DEMO_COUNTS = FULL_DEMO_COUNTS;
