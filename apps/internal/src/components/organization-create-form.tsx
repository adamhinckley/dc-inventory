"use client";

import {
  getGetInternalSessionQueryKey,
  useCreateInternalOrganization,
  type createInternalOrganization,
} from "@dc-inventory/api-client-internal";
import { Form, TextInput, useFormSubmit } from "@dc-inventory/ui";
import { deriveOrganizationSlugFromDisplayName } from "../lib/organization-slug";
import { Building2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useFormContext, type ControllerFieldState, type ControllerRenderProps } from "react-hook-form";
import { z } from "zod";

const createOrganizationSchema = z.object({
  name: z.string().min(1, "Company name is required"),
  slug: z.string().min(1, "Slug is required"),
  staffDisplayName: z.string().min(1, "First admin name is required"),
  staffEmail: z.string().email("Valid email is required"),
});

type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;

type SuccessState = {
  companyName: string;
  adminName: string;
  email: string;
};

function OrganizationSlugFields({
  slugTouched,
  setSlugTouched,
}: {
  slugTouched: boolean;
  setSlugTouched: (value: boolean) => void;
}) {
  const form = useFormContext<CreateOrganizationInput>();
  const companyName = form.watch("name");

  useEffect(() => {
    if (!slugTouched) {
      form.setValue("slug", deriveOrganizationSlugFromDisplayName(companyName), {
        shouldValidate: true,
      });
    }
  }, [companyName, form, slugTouched]);

  return (
    <>
      <Form.Field name="name" label="Company Display Name" required form={{ kind: "text" }} />
      <Form.Field
        name="slug"
        label="Slug"
        required
        form={{
          kind: "text",
          render: ({
            rhf,
            fieldState,
          }: {
            rhf: ControllerRenderProps<CreateOrganizationInput, "slug">;
            fieldState: ControllerFieldState;
          }) => (
            <TextInput
              name={rhf.name}
              value={String(rhf.value ?? "")}
              onBlur={rhf.onBlur}
              ref={rhf.ref}
              onChange={(value: string) => {
                setSlugTouched(true);
                rhf.onChange(value);
              }}
              data-invalid={fieldState.error ? true : undefined}
              data-testid="form-slug"
            />
          ),
        }}
      />
      <p className="text-body-sm text-fg-secondary">
        Auto-filled from the display name (lowercase, hyphens). Edit if that slug is already taken.
      </p>
    </>
  );
}

export function OrganizationCreateForm() {
  const [slugTouched, setSlugTouched] = useState(false);
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const submittedRef = useRef<CreateOrganizationInput | null>(null);
  const { mutateAsync } = useCreateInternalOrganization();

  const onSubmit = useFormSubmit<
    CreateOrganizationInput,
    Awaited<ReturnType<typeof createInternalOrganization>>
  >({
    mutate: async (data) => {
      submittedRef.current = data;
      return mutateAsync({
        data: {
          name: data.name.trim(),
          slug: data.slug.trim(),
          staffDisplayName: data.staffDisplayName.trim(),
          staffEmail: data.staffEmail.trim(),
        },
      });
    },
    successMessage: "Organization created",
    invalidate: getGetInternalSessionQueryKey(),
    onSuccess: (result) => {
      const data = submittedRef.current;
      if (result.status === 201 && data !== null) {
        setSuccess({
          companyName: data.name.trim(),
          adminName: data.staffDisplayName.trim(),
          email: data.staffEmail.trim(),
        });
      }
    },
  });

  if (success !== null) {
    return (
      <section className="section-flat max-w-xl p-panel">
        <h2 className="page-title">Invite Sent</h2>
        <p className="page-description mt-2">
          Company {success.companyName} created. Invite sent to {success.adminName} (
          {success.email}).
        </p>
        <p className="mt-4 text-body-sm text-fg-secondary">
          No password was set on this form. The first admin sets it from the invite link.
        </p>
      </section>
    );
  }

  return (
    <Form
      schema={createOrganizationSchema}
      defaultValues={{ name: "", slug: "", staffDisplayName: "", staffEmail: "" }}
      onSubmit={onSubmit}
    >
      <OrganizationSlugFields slugTouched={slugTouched} setSlugTouched={setSlugTouched} />
      <Form.Field name="staffDisplayName" label="First Admin Name" required form={{ kind: "text" }} />
      <Form.Field name="staffEmail" label="First Admin Email" required form={{ kind: "email" }} />
      <Form.RootError />
      <Form.Actions>
        <Form.Submit>
          <Building2 className="size-icon-lg" aria-hidden />
          Add Company And Invite
        </Form.Submit>
      </Form.Actions>
    </Form>
  );
}
