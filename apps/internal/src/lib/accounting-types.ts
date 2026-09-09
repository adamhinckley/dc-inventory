import type {
  getInternalAccountingSummary,
  listInternalAccountingCustomerBalances,
  listInternalAccountingPayments,
} from "@dc-inventory/api-client-internal";
import type { AGING_BUCKET_KEYS } from "./customer-accounting-format";

export type AccountingSummary = Extract<
  Awaited<ReturnType<typeof getInternalAccountingSummary>>,
  { status: 200 }
>["data"];

export type AccountingSummaryAging = AccountingSummary["aging"];

export type AccountingBalanceRow = Extract<
  Awaited<ReturnType<typeof listInternalAccountingCustomerBalances>>,
  { status: 200 }
>["data"]["items"][number];

export type AccountingPaymentRow = Extract<
  Awaited<ReturnType<typeof listInternalAccountingPayments>>,
  { status: 200 }
>["data"]["items"][number];

export type AccountingAgingBucket = (typeof AGING_BUCKET_KEYS)[number];

export type AccountingPaymentMethod = AccountingPaymentRow["method"];
