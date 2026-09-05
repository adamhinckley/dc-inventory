import type { updateInternalCustomer } from "@dc-inventory/api-client-internal";
import type { CustomerAccountStatus, CustomerDetail } from "./customer-types";

export type CustomerEditInput = {
  name: string;
  terms: string;
  creditLimitCents: number;
  taxId?: string | null;
  accountStatus: CustomerAccountStatus;
  staffNote?: string | null;
};

type UpdateCustomerBody = Parameters<typeof updateInternalCustomer>[1];

export function buildUpdateCustomerBody(
  customer: Pick<CustomerDetail, "currency">,
  data: CustomerEditInput,
): UpdateCustomerBody {
  return {
    name: data.name.trim(),
    terms: data.terms.trim(),
    creditLimitCents: data.creditLimitCents,
    currency: customer.currency,
    taxId: data.taxId?.trim() ? data.taxId.trim() : null,
    accountStatus: data.accountStatus,
    staffNote: data.staffNote?.trim() ? data.staffNote.trim() : null,
  };
}
