"use client";

import {
  getListInternalOrganizationsQueryKey,
  useCreateInternalOrganization,
  type createInternalOrganization,
} from "@dc-inventory/api-client-internal";
import { Form, TextInput, useExplorerView, useFormSubmit } from "@dc-inventory/ui";
import { deriveOrganizationSlugFromDisplayName } from "../lib/organization-slug";
import { Building2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useFormContext, type ControllerFieldState, type ControllerRenderProps } from "react-hook-form";
import { z } from "zod";

const createOrganizationSchema = z.object({
  name: z.string().min(1, "Company name is required"),
  slug: z.string().min(1, "Slug is required"),
  staffDisplayName: z.string().min(1, "First admin name is required"),
  staffEmail: z.string().email("Valid email is required"),
});

type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;

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
    if (slugTouched) {
      return;
    }
    const slug = deriveOrganizationSlugFromDisplayName(companyName);
    // Empty derived slug is the initial (and cleared-name) state. Validating
    // it marks the field invalid before the user has typed anything.
    form.setValue("slug", slug, { shouldValidate: slug.length > 0 });
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
  const { createOpen, setCreateOpen } = useExplorerView();
  const [slugTouched, setSlugTouched] = useState(false);
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    if (!createOpen) {
      setSlugTouched(false);
      setFormKey((key) => key + 1);
    }
  }, [createOpen]);
  const { mutateAsync } = useCreateInternalOrganization();

  const onSubmit = useFormSubmit<
    CreateOrganizationInput,
    Awaited<ReturnType<typeof createInternalOrganization>>
  >({
    mutate: async (data) =>
      mutateAsync({
        data: {
          name: data.name.trim(),
          slug: data.slug.trim(),
          staffDisplayName: data.staffDisplayName.trim(),
          staffEmail: data.staffEmail.trim(),
        },
      }),
    successMessage: "Invite sent",
    invalidate: getListInternalOrganizationsQueryKey(),
    onSuccess: (result) => {
      if (result.status === 201) {
        setCreateOpen(false);
      }
    },
  });

  return (
    <Form
      key={formKey}
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
