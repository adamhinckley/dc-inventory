"use client";

import {
  getListInternalCustomerContactsQueryKey,
  useCreateInternalCustomerContact,
  useListInternalCustomerContacts,
  useUpdateInternalCustomerContact,
} from "@dc-inventory/api-client-internal";
import {
  Button,
  Form,
  FormDialog,
  Table,
  useTable,
  type TableColumnDef,
} from "@dc-inventory/ui";
import { Pencil, Plus } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { z } from "zod";
import type { CustomerContactRow } from "../lib/customer-types";

const contactSchema = z.object({
  name: z.string().min(1),
  email: z.string().min(1),
  phone: z.string().optional().nullable(),
});

type ContactFormInput = z.infer<typeof contactSchema>;

function toContactBody(data: ContactFormInput) {
  return {
    name: data.name.trim(),
    email: data.email.trim(),
    phone: data.phone?.trim() ? data.phone.trim() : null,
  };
}

function ContactFormFields() {
  return (
    <>
      <Form.Field name="name" label="Name" required form={{ kind: "text" }} />
      <Form.Field name="email" label="Email" required form={{ kind: "text" }} />
      <Form.Field name="phone" label="Phone" form={{ kind: "text" }} />
    </>
  );
}

export function CustomerContactsPanel({
  customerId,
  canManage,
}: {
  customerId: string;
  canManage: boolean;
}) {
  const query = useListInternalCustomerContacts(customerId);
  const items =
    query.data?.status === 200 ? query.data.data.items : ([] as CustomerContactRow[]);
  const { mutateAsync: createContact } = useCreateInternalCustomerContact();
  const { mutateAsync: updateContact } = useUpdateInternalCustomerContact();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerContactRow | null>(null);

  const rowActions = useCallback(
    (row: CustomerContactRow) => (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setEditing(row)}
      >
        <Pencil className="size-icon" aria-hidden />
        Edit
      </Button>
    ),
    [],
  );

  const columns = useMemo<TableColumnDef<CustomerContactRow>[]>(
    () => [
      { id: "name", label: "Name", sort: false as const },
      { id: "email", label: "Email", sort: false as const },
      {
        id: "phone",
        label: "Phone",
        sort: false as const,
        render: ({ record }) => record.phone ?? "—",
      },
    ],
    [],
  );

  const table = useTable({
    data: items,
    columns,
    rowActions: canManage ? rowActions : undefined,
    getRowId: (row) => row.id,
    fillColumn: "name",
    enableSorting: false,
    enableSelection: false,
    enablePagination: false,
  });

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-form-section">
      <header className="flex flex-col gap-region sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-heading-sm">Contacts</h2>
          <p className="text-body-sm text-fg-secondary mt-1">
            People associated with this customer account.
          </p>
        </div>
        {canManage ? (
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="size-icon" aria-hidden />
            Add Contact
          </Button>
        ) : null}
      </header>

      <Table
        sticky
        table={table}
        emptyMessage={query.isLoading ? "Loading contacts…" : "No contacts yet."}
      >
        <Table.Header />
        <Table.Body />
        <Table.Empty />
      </Table>

      {canManage ? (
        <>
          <FormDialog
            open={createOpen}
            onOpenChange={setCreateOpen}
            title="Add contact"
            schema={contactSchema}
            defaultValues={{ name: "", email: "", phone: "" }}
            mutate={(data) =>
              createContact({ id: customerId, data: toContactBody(data) })
            }
            successMessage="Contact added"
            invalidate={[getListInternalCustomerContactsQueryKey(customerId)]}
            submitLabel="Add Contact"
            data-testid="customer-contact-create-dialog"
          >
            <ContactFormFields />
          </FormDialog>

          {editing ? (
            <FormDialog
              open
              onOpenChange={(open) => {
                if (!open) {
                  setEditing(null);
                }
              }}
              title="Edit contact"
              schema={contactSchema}
              defaultValues={{
                name: editing.name,
                email: editing.email,
                phone: editing.phone ?? "",
              }}
              mutate={(data) =>
                updateContact({
                  id: customerId,
                  contactId: editing.id,
                  data: toContactBody(data),
                })
              }
              successMessage="Contact updated"
              invalidate={[getListInternalCustomerContactsQueryKey(customerId)]}
              submitLabel="Save Changes"
              data-testid="customer-contact-edit-dialog"
            >
              <ContactFormFields />
            </FormDialog>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
