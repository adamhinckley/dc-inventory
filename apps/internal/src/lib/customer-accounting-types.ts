import type {
  getInternalCustomerAccounting,
  listInternalCustomerInvoices,
  listInternalCustomerPayments,
} from "@dc-inventory/api-client-internal";

export type CustomerAccountingSummary = Extract<
  Awaited<ReturnType<typeof getInternalCustomerAccounting>>,
  { status: 200 }
>["data"];

export type CustomerInvoiceRow = Extract<
  Awaited<ReturnType<typeof listInternalCustomerInvoices>>,
  { status: 200 }
>["data"]["items"][number];

export type CustomerPaymentRow = Extract<
  Awaited<ReturnType<typeof listInternalCustomerPayments>>,
  { status: 200 }
>["data"]["items"][number];

export type CustomerInvoiceStatus = CustomerInvoiceRow["status"];
