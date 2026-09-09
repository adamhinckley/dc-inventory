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

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export function buildUpdateCustomerBody(
  customer: Pick<
    CustomerDetail,
    | "name"
    | "terms"
    | "creditLimitCents"
    | "currency"
    | "taxId"
    | "accountStatus"
    | "staffNote"
  >,
  data: CustomerEditInput,
): UpdateCustomerBody {
  const body: UpdateCustomerBody = {};

  const name = data.name.trim();
  if (name !== customer.name) {
    body.name = name;
  }

  const terms = data.terms.trim();
  if (terms !== customer.terms) {
    body.terms = terms;
  }

  if (data.creditLimitCents !== customer.creditLimitCents) {
    body.creditLimitCents = data.creditLimitCents;
  }

  const taxId = normalizeOptionalText(data.taxId);
  const existingTaxId = normalizeOptionalText(customer.taxId);
  if (taxId !== existingTaxId) {
    body.taxId = taxId;
  }

  if (data.accountStatus !== customer.accountStatus) {
    body.accountStatus = data.accountStatus;
  }

  const staffNote = normalizeOptionalText(data.staffNote);
  const existingStaffNote = normalizeOptionalText(customer.staffNote);
  if (staffNote !== existingStaffNote) {
    body.staffNote = staffNote;
  }

  return body;
}
