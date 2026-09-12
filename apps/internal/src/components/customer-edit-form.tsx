"use client";

import {
  getGetInternalCustomerQueryKey,
  getListInternalCustomersQueryKey,
  useUpdateInternalCustomer,
} from "@dc-inventory/api-client-internal";
import { Form, useDetailView, useFormSubmit } from "@dc-inventory/ui";
import { Save } from "lucide-react";
import { z } from "zod";
import { CUSTOMER_ACCOUNT_STATUS_OPTIONS } from "../lib/customer-account-status";
import { centsToWholeDollars, wholeDollarsToCents } from "../lib/customer-credit-limit";
import { buildUpdateCustomerBody } from "../lib/customer-edit-body";
import { customerTermsSelectOptions } from "../lib/customer-terms";
import type { CustomerDetail } from "../lib/customer-types";

const editCustomerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  terms: z.string().min(1, "Terms are required"),
  creditLimitDollars: z.coerce.number().min(0),
  taxId: z.string().optional().nullable(),
  accountStatus: z.enum(["active", "on_hold", "inactive"]),
  staffNote: z.string().optional().nullable(),
});

type EditCustomerInput = z.infer<typeof editCustomerSchema>;

export function CustomerEditForm({ customer }: { customer: CustomerDetail }) {
  const { setEditOpen } = useDetailView();
  const { mutateAsync } = useUpdateInternalCustomer();

  const onSubmit = useFormSubmit<EditCustomerInput>({
    mutate: (data) =>
      mutateAsync({
        id: customer.id,
        data: buildUpdateCustomerBody(customer, {
          name: data.name,
          terms: data.terms,
          creditLimitCents: wholeDollarsToCents(data.creditLimitDollars),
          taxId: data.taxId,
          accountStatus: data.accountStatus,
          staffNote: data.staffNote,
        }),
      }),
    successMessage: "Customer updated",
    invalidate: [
      getListInternalCustomersQueryKey(),
      getGetInternalCustomerQueryKey(customer.id),
    ],
    onSuccess: () => setEditOpen(false),
  });

  return (
    <Form
      schema={editCustomerSchema}
      defaultValues={{
        name: customer.name,
        terms: customer.terms,
        creditLimitDollars: centsToWholeDollars(customer.creditLimitCents),
        taxId: customer.taxId ?? "",
        accountStatus: customer.accountStatus,
        staffNote: customer.staffNote ?? "",
      }}
      onSubmit={onSubmit}
    >
      <Form.Field
        name="name"
        label="Business name"
        required
        form={{ kind: "text" }}
      />
      <div>
        <p className="text-label text-fg-secondary">Customer #</p>
        <p className="mt-1 tabular-nums">{customer.customerNumber}</p>
      </div>
      <Form.Field
        name="terms"
        label="Terms"
        required
        form={{
          kind: "select",
          options: [...customerTermsSelectOptions(customer.terms)],
        }}
      />
      <Form.Field
        name="creditLimitDollars"
        label="Credit Limit ($)"
        required
        form={{ kind: "number", min: 0, step: 1 }}
      />
      <Form.Field name="taxId" label="Tax ID" form={{ kind: "text" }} />
      <Form.Field
        name="accountStatus"
        label="Status"
        required
        form={{
          kind: "select",
          options: CUSTOMER_ACCOUNT_STATUS_OPTIONS.map((option) => ({
            value: option.value,
            label: option.label,
          })),
        }}
      />
      <Form.Field
        name="staffNote"
        label="Staff note"
        form={{ kind: "textarea" }}
      />
      <Form.RootError />
      <Form.Actions>
        <Form.Submit>
          <Save className="size-icon-lg" aria-hidden />
          Save Changes
        </Form.Submit>
      </Form.Actions>
    </Form>
  );
}
