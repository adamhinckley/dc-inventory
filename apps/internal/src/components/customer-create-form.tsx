"use client";

import {
  getListInternalCustomersQueryKey,
  useCreateInternalCustomer,
  type createInternalCustomer,
} from "@dc-inventory/api-client-internal";
import { Form, TextInput, useExplorerView, useFormSubmit } from "@dc-inventory/ui";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  useFormContext,
  type ControllerFieldState,
  type ControllerRenderProps,
} from "react-hook-form";
import { z } from "zod";
import { useCanManageStaff } from "../lib/staff-manage";

const STAFF_FOR_THEM_DEFAULT_CREDIT_LIMIT_CENTS = 1_000_000;

const baseCreateCustomerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  terms: z.string().min(1, "Terms are required"),
  creditLimitCents: z.coerce.number().int().min(0, "Credit limit is required"),
  customerNumber: z.string().optional(),
  wholesaleEmail: z.string().optional(),
  wholesaleDisplayName: z.string().optional(),
});

type CreateCustomerInput = z.infer<typeof baseCreateCustomerSchema>;

function WholesaleDisplayNameField({
  displayNameTouched,
  setDisplayNameTouched,
}: {
  displayNameTouched: boolean;
  setDisplayNameTouched: (value: boolean) => void;
}) {
  const form = useFormContext<CreateCustomerInput>();
  const customerName = form.watch("name");

  useEffect(() => {
    if (!displayNameTouched) {
      form.setValue("wholesaleDisplayName", customerName, {
        shouldValidate: true,
      });
    }
  }, [customerName, displayNameTouched, form]);

  return (
    <Form.Field
      name="wholesaleDisplayName"
      label="Wholesale Display Name"
      required
      form={{
        kind: "text",
        render: ({
          rhf,
          fieldState,
        }: {
          rhf: ControllerRenderProps<CreateCustomerInput, "wholesaleDisplayName">;
          fieldState: ControllerFieldState;
        }) => (
          <TextInput
            name={rhf.name}
            value={String(rhf.value ?? "")}
            onBlur={() => {
              setDisplayNameTouched(true);
              rhf.onBlur();
            }}
            ref={rhf.ref}
            onFocus={() => {
              setDisplayNameTouched(true);
            }}
            onChange={(value: string) => {
              setDisplayNameTouched(true);
              rhf.onChange(value);
            }}
            data-invalid={fieldState.error ? true : undefined}
          />
        ),
      }}
    />
  );
}

export function CustomerCreateForm() {
  const router = useRouter();
  const { setCreateOpen } = useExplorerView();
  const { mutateAsync } = useCreateInternalCustomer();
  const canManageStaff = useCanManageStaff();
  const [displayNameTouched, setDisplayNameTouched] = useState(false);

  const createCustomerSchema = baseCreateCustomerSchema.superRefine((data, ctx) => {
    if (!canManageStaff) {
      return;
    }
    const email = data.wholesaleEmail?.trim() ?? "";
    if (email.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "Wholesale user email is required",
        path: ["wholesaleEmail"],
      });
    }
    const displayName = data.wholesaleDisplayName?.trim() ?? "";
    if (displayName.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "Wholesale display name is required",
        path: ["wholesaleDisplayName"],
      });
    }
  });

  const onSubmit = useFormSubmit<CreateCustomerInput, Awaited<ReturnType<typeof createInternalCustomer>>>({
    mutate: (data) =>
      mutateAsync({
        data: {
          name: data.name,
          terms: data.terms,
          ...(canManageStaff || data.creditLimitCents !== 0
            ? { creditLimitCents: data.creditLimitCents }
            : {}),
          customerNumber:
            data.customerNumber !== undefined && data.customerNumber.trim().length > 0
              ? data.customerNumber.trim()
              : undefined,
          ...(canManageStaff
            ? {
                wholesaleEmail: data.wholesaleEmail?.trim(),
                wholesaleDisplayName: data.wholesaleDisplayName?.trim(),
              }
            : {}),
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
      defaultValues={{
        name: "",
        terms: "",
        creditLimitCents: canManageStaff ? STAFF_FOR_THEM_DEFAULT_CREDIT_LIMIT_CENTS : 0,
        customerNumber: "",
        wholesaleEmail: "",
        wholesaleDisplayName: "",
      }}
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
      {canManageStaff ? (
        <>
          <Form.Field
            name="wholesaleEmail"
            label="Wholesale User Email"
            required
            form={{ kind: "email" }}
          />
          <WholesaleDisplayNameField
            displayNameTouched={displayNameTouched}
            setDisplayNameTouched={setDisplayNameTouched}
          />
        </>
      ) : null}
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
