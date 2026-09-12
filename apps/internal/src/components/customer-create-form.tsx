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
import {
  STAFF_FOR_THEM_DEFAULT_CREDIT_LIMIT_DOLLARS,
  wholeDollarsToCents,
} from "../lib/customer-credit-limit";
import { CUSTOMER_TERMS, CUSTOMER_TERMS_OPTIONS } from "../lib/customer-terms";
import { useCanManageStaff } from "../lib/staff-manage";

const baseCreateCustomerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  terms: z.enum(CUSTOMER_TERMS),
  creditLimitDollars: z.coerce.number().int().min(0, "Credit limit is required"),
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
    if (displayNameTouched) {
      return;
    }
    const next = customerName;
    // Empty autofill is the initial (and cleared-name) state. Validating it
    // marks the field invalid before the user has typed anything.
    form.setValue("wholesaleDisplayName", next, {
      shouldValidate: next.trim().length > 0,
    });
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
  const { createOpen, setCreateOpen } = useExplorerView();
  const { mutateAsync } = useCreateInternalCustomer();
  const canManageStaff = useCanManageStaff();
  const [displayNameTouched, setDisplayNameTouched] = useState(false);
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    if (!createOpen) {
      setDisplayNameTouched(false);
      setFormKey((key) => key + 1);
    }
  }, [createOpen]);

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

  const onSubmit = useFormSubmit<
    CreateCustomerInput,
    Awaited<ReturnType<typeof createInternalCustomer>>
  >({
    mutate: (data) =>
      mutateAsync({
        data: {
          name: data.name,
          terms: data.terms,
          ...(canManageStaff || data.creditLimitDollars !== 0
            ? { creditLimitCents: wholeDollarsToCents(data.creditLimitDollars) }
            : {}),
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
      key={formKey}
      schema={createCustomerSchema}
      defaultValues={{
        name: "",
        terms: "Net 30",
        creditLimitDollars: canManageStaff ? STAFF_FOR_THEM_DEFAULT_CREDIT_LIMIT_DOLLARS : 0,
        wholesaleEmail: "",
        wholesaleDisplayName: "",
      }}
      onSubmit={onSubmit}
    >
      <Form.Field name="name" label="Name" required form={{ kind: "text" }} />
      <Form.Field
        name="terms"
        label="Terms"
        required
        form={{
          kind: "select",
          options: [...CUSTOMER_TERMS_OPTIONS],
        }}
      />
      <Form.Field
        name="creditLimitDollars"
        label="Credit Limit ($)"
        required
        form={{ kind: "number", min: 0, step: 1 }}
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
