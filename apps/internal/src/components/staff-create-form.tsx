"use client";

import {
  useCreateInternalStaff,
  type createInternalStaff,
} from "@dc-inventory/api-client-internal";
import { Button, Form, useFormSubmit } from "@dc-inventory/ui";
import { UserPlus } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { STAFF_ROLE_OPTIONS } from "../lib/staff-role-labels";
import { throwIfStaffWriteFailed } from "../lib/staff-write-errors";

const staffRoleValues = [
  "admin",
  "purchasing",
  "warehouse",
  "sales_support",
  "accounting",
] as const;

const createStaffSchema = z.object({
  displayName: z.string().min(1, "Display name is required"),
  email: z.string().min(1, "Email is required"),
  roles: z
    .array(z.enum(staffRoleValues))
    .min(1, "Select at least one role"),
});

type CreateStaffInput = z.infer<typeof createStaffSchema>;

export function StaffCreateForm() {
  const { mutateAsync } = useCreateInternalStaff();
  const [inviteSentTo, setInviteSentTo] = useState<string | null>(null);

  const onSubmit = useFormSubmit<
    CreateStaffInput,
    Awaited<ReturnType<typeof createInternalStaff>>
  >({
    mutate: async (data) => {
      const result = await mutateAsync({
        data: {
          displayName: data.displayName,
          email: data.email,
          roles: data.roles,
        },
      });
      throwIfStaffWriteFailed(result);
      return result;
    },
    successMessage: "Invite sent",
    onSuccess: (result) => {
      if (result.status === 201) {
        setInviteSentTo(result.data.email);
      }
    },
  });

  if (inviteSentTo !== null) {
    return (
      <div className="max-w-xl space-y-form-section rounded-section border border-border bg-surface p-region">
        <h2 className="text-heading-sm">Invite Sent</h2>
        <p className="text-body text-fg-secondary">
          An invite email was sent to <span className="font-medium text-fg">{inviteSentTo}</span>.
        </p>
        <Button type="button" variant="secondary" onClick={() => setInviteSentTo(null)}>
          Invite Another Staff Member
        </Button>
      </div>
    );
  }

  return (
    <Form
      schema={createStaffSchema}
      defaultValues={{ displayName: "", email: "", roles: [] }}
      onSubmit={onSubmit}
      className="max-w-xl space-y-form-section"
    >
      <Form.Field
        name="displayName"
        label="Display name"
        required
        form={{ kind: "text" }}
      />
      <Form.Field name="email" label="Email" required form={{ kind: "text" }} />
      <Form.Field
        name="roles"
        label="Roles"
        required
        form={{
          kind: "multiselect",
          options: STAFF_ROLE_OPTIONS,
          placeholder: "Select roles",
        }}
      />
      <Form.RootError />
      <Form.Actions>
        <Form.Submit>
          <UserPlus className="size-icon-lg" aria-hidden />
          Send Invite
        </Form.Submit>
      </Form.Actions>
    </Form>
  );
}
