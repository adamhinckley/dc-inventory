import type { getInternalCustomerAccountingWorkspace } from "@dc-inventory/api-client-internal";

export type CustomerAccountingWorkspace = Extract<
  Awaited<ReturnType<typeof getInternalCustomerAccountingWorkspace>>,
  { status: 200 }
>["data"];

export type CustomerAccountingSummary = CustomerAccountingWorkspace["summary"];

export type CustomerInvoiceRow = CustomerAccountingWorkspace["invoices"][number];

export type CustomerPaymentRow = CustomerAccountingWorkspace["payments"][number];

export type CustomerInvoiceStatus = CustomerInvoiceRow["status"];
