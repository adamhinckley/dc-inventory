"use client";

import {
  getListInternalCustomerExemptionCertificatesQueryKey,
  useCreateInternalCustomerExemptionCertificate,
  useListInternalCustomerExemptionCertificates,
  useUpdateInternalCustomerExemptionCertificate,
} from "@dc-inventory/api-client-internal";
import {
  Button,
  Form,
  FormDialog,
  Table,
  formatDateTime,
  useTable,
  type TableColumnDef,
} from "@dc-inventory/ui";
import { Pencil, Plus } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { z } from "zod";
import type { CustomerCertificateRow } from "../lib/customer-types";

const emptyToNull = (value: unknown) =>
  value === "" || value === undefined ? null : value;

const certificateSchema = z.object({
  jurisdiction: z.string().min(1),
  entityUseCode: z.string().optional().nullable(),
  expiresAt: z.preprocess(emptyToNull, z.union([z.string(), z.null()])),
});

type CertificateFormInput = z.infer<typeof certificateSchema>;

function toCertificateBody(data: CertificateFormInput, status: string) {
  return {
    jurisdiction: data.jurisdiction.trim(),
    status,
    entityUseCode: data.entityUseCode?.trim() ? data.entityUseCode.trim() : null,
    expiresAt: data.expiresAt?.trim() ? data.expiresAt.trim() : null,
  };
}

function CertificateFormFields() {
  return (
    <>
      <Form.Field
        name="jurisdiction"
        label="Jurisdiction"
        required
        form={{ kind: "text" }}
      />
      <Form.Field
        name="entityUseCode"
        label="Entity use code"
        form={{ kind: "text" }}
      />
      <Form.Field name="expiresAt" label="Expires at" form={{ kind: "text" }} />
    </>
  );
}

export function CustomerCertificatesPanel({
  customerId,
  canManage,
}: {
  customerId: string;
  canManage: boolean;
}) {
  const query = useListInternalCustomerExemptionCertificates(customerId);
  const items =
    query.data?.status === 200
      ? query.data.data.items
      : ([] as CustomerCertificateRow[]);
  const { mutateAsync: createCertificate } =
    useCreateInternalCustomerExemptionCertificate();
  const { mutateAsync: updateCertificate } =
    useUpdateInternalCustomerExemptionCertificate();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerCertificateRow | null>(null);

  const rowActions = useCallback(
    (row: CustomerCertificateRow) => (
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

  const columns = useMemo<TableColumnDef<CustomerCertificateRow>[]>(
    () => [
      { id: "jurisdiction", label: "Jurisdiction", sort: false as const },
      {
        id: "entityUseCode",
        label: "Entity use code",
        sort: false as const,
        render: ({ record }) => record.entityUseCode ?? "—",
      },
      {
        id: "expiresAt",
        label: "Expires",
        sort: false as const,
        render: ({ record }) =>
          record.expiresAt ? formatDateTime(record.expiresAt) : "—",
      },
    ],
    [],
  );

  const table = useTable({
    data: items,
    columns,
    rowActions: canManage ? rowActions : undefined,
    getRowId: (row) => row.id,
    fillColumn: "jurisdiction",
    enableSorting: false,
    enableSelection: false,
    enablePagination: false,
  });

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-form-section">
      <header className="flex flex-col gap-region sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-heading-sm">Certificates</h2>
          <p className="text-body-sm text-fg-secondary mt-1">
            Exemption certificate metadata for this customer.
          </p>
        </div>
        {canManage ? (
          <Button type="button" variant="primary" onClick={() => setCreateOpen(true)}>
            <Plus className="size-icon-lg" aria-hidden />
            Add Certificate
          </Button>
        ) : null}
      </header>

      <Table
        sticky
        table={table}
        emptyMessage={
          query.isLoading ? "Loading certificates…" : "No certificates yet."
        }
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
            title="Add certificate"
            schema={certificateSchema}
            defaultValues={{
              jurisdiction: "",
              entityUseCode: "",
              expiresAt: "",
            }}
            mutate={(data) =>
              createCertificate({
                id: customerId,
                data: toCertificateBody(data, "active"),
              })
            }
            successMessage="Certificate added"
            invalidate={[
              getListInternalCustomerExemptionCertificatesQueryKey(customerId),
            ]}
            submitLabel="Add Certificate"
            data-testid="customer-certificate-create-dialog"
          >
            <CertificateFormFields />
          </FormDialog>

          {editing ? (
            <FormDialog
              open
              onOpenChange={(open) => {
                if (!open) {
                  setEditing(null);
                }
              }}
              title="Edit certificate"
              schema={certificateSchema}
              defaultValues={{
                jurisdiction: editing.jurisdiction,
                entityUseCode: editing.entityUseCode ?? "",
                expiresAt: editing.expiresAt ?? "",
              }}
              mutate={(data) =>
                updateCertificate({
                  id: customerId,
                  certificateId: editing.id,
                  data: toCertificateBody(data, editing.status),
                })
              }
              successMessage="Certificate updated"
              invalidate={[
                getListInternalCustomerExemptionCertificatesQueryKey(customerId),
              ]}
              submitLabel="Save Changes"
              data-testid="customer-certificate-edit-dialog"
            >
              <CertificateFormFields />
            </FormDialog>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
