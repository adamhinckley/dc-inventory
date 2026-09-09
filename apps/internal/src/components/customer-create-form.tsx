"use client";

import {
  getListInternalCustomersQueryKey,
  useCreateInternalCustomer,
  type createInternalCustomer,
} from "@dc-inventory/api-client-internal";
import { Form, useExplorerView, useFormSubmit } from "@dc-inventory/ui";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { z } from "zod";

const createCustomerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  terms: z.string().min(1, "Terms are required"),
  creditLimitCents: z.coerce.number().int().min(0, "Credit limit is required"),
  customerNumber: z.string().optional(),
});

type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

export function CustomerCreateForm() {
  const router = useRouter();
  const { setCreateOpen } = useExplorerView();
  const { mutateAsync } = useCreateInternalCustomer();

  const onSubmit = useFormSubmit<CreateCustomerInput, Awaited<ReturnType<typeof createInternalCustomer>>>({
    mutate: (data) =>
      mutateAsync({
        data: {
          name: data.name,
          terms: data.terms,
          ...(data.creditLimitCents !== 0 ? { creditLimitCents: data.creditLimitCents } : {}),
          customerNumber:
            data.customerNumber !== undefined && data.customerNumber.trim().length > 0
              ? data.customerNumber.trim()
              : undefined,
        },
      }),
    successMessage: "Customer created",
    invalidate: getListInternalCustomersQueryKey(),
    onSuccess: (result) => {
      setCreateOpen(false);
      if (result.status === 201) {
        router.push(`/customers/${result.data.id}`);
      }
    },
  });

  return (
    <Form
      schema={createCustomerSchema}
      defaultValues={{ name: "", terms: "", creditLimitCents: 0, customerNumber: "" }}
      onSubmit={onSubmit}
    >
      <Form.Field name="name" label="Name" required form={{ kind: "text" }} />
      <Form.Field name="terms" label="Terms" required form={{ kind: "text" }} />
      <Form.Field
        name="creditLimitCents"
        label="Credit limit"
        required
        form={{ kind: "number" }}
      />
      <Form.Field
        name="customerNumber"
        label="Customer #"
        form={{ kind: "text" }}
      />
      <Form.RootError />
      <Form.Actions>
        <Form.Submit>
          <Plus className="size-icon-lg" aria-hidden />
          Create Customer
        </Form.Submit>
      </Form.Actions>
    </Form>
  );
}
