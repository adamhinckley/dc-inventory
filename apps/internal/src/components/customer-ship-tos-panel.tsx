"use client";

import {
  getListInternalCustomerShipTosQueryKey,
  useCreateInternalCustomerShipTo,
  useListInternalCustomerShipTos,
  useUpdateInternalCustomerShipTo,
} from "@dc-inventory/api-client-internal";
import {
  Button,
  Form,
  FormDialog,
  Table,
  useTable,
  type TableColumnDef,
} from "@dc-inventory/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Star } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { z } from "zod";
import { formatPostalAddressInline } from "../lib/postal-address-format";
import type { CustomerShipToRow } from "../lib/customer-types";

const shipToSchema = z.object({
  line1: z.string().min(1),
  line2: z.string().optional().nullable(),
  city: z.string().min(1),
  region: z.string().min(1),
  postal: z.string().min(1),
  country: z.string().min(1),
  isDefault: z.boolean().optional(),
});

type ShipToFormInput = z.infer<typeof shipToSchema>;

function toShipToBody(data: ShipToFormInput) {
  return {
    line1: data.line1.trim(),
    line2: data.line2?.trim() ? data.line2.trim() : null,
    city: data.city.trim(),
    region: data.region.trim(),
    postal: data.postal.trim(),
    country: data.country.trim(),
    isDefault: data.isDefault,
  };
}

function ShipToFormFields({ showDefault = false }: { showDefault?: boolean }) {
  return (
    <>
      <Form.Field name="line1" label="Line 1" required form={{ kind: "text" }} />
      <Form.Field name="line2" label="Line 2" form={{ kind: "text" }} />
      <Form.Field name="city" label="City" required form={{ kind: "text" }} />
      <Form.Field name="region" label="State / region" required form={{ kind: "text" }} />
      <Form.Field name="postal" label="Postal code" required form={{ kind: "text" }} />
      <Form.Field name="country" label="Country" required form={{ kind: "text" }} />
      {showDefault ? (
        <Form.Field name="isDefault" label="Default ship-to" form={{ kind: "boolean" }} />
      ) : null}
    </>
  );
}

export function CustomerShipTosPanel({
  customerId,
  canManage,
}: {
  customerId: string;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const query = useListInternalCustomerShipTos(customerId);
  const items =
    query.data?.status === 200 ? query.data.data.items : ([] as CustomerShipToRow[]);
  const { mutateAsync: createShipTo } = useCreateInternalCustomerShipTo();
  const { mutateAsync: updateShipTo } = useUpdateInternalCustomerShipTo();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerShipToRow | null>(null);

  const invalidateShipTos = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: getListInternalCustomerShipTosQueryKey(customerId),
    });
  }, [customerId, queryClient]);

  const setDefault = useCallback(
    async (shipTo: CustomerShipToRow) => {
      if (shipTo.isDefault) {
        return;
      }
      await updateShipTo({
        id: customerId,
        shipToId: shipTo.id,
        data: { isDefault: true },
      });
      await invalidateShipTos();
    },
    [customerId, invalidateShipTos, updateShipTo],
  );

  const rowActions = useCallback(
    (row: CustomerShipToRow) => (
      <div className="flex items-center gap-tight">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setEditing(row)}
        >
          <Pencil className="size-icon" aria-hidden />
          Edit
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={row.isDefault}
          onClick={() => void setDefault(row)}
        >
          <Star className="size-icon" aria-hidden />
          Set Default
        </Button>
      </div>
    ),
    [setDefault],
  );

  const columns = useMemo<TableColumnDef<CustomerShipToRow>[]>(
    () => [
      {
        id: "address",
        label: "Address",
        sort: false as const,
        render: ({ record }) => formatPostalAddressInline(record),
      },
      {
        id: "default",
        label: "Default",
        sort: false as const,
        width: 96,
        render: ({ record }) => (record.isDefault ? "Yes" : "—"),
      },
    ],
    [],
  );

  const table = useTable({
    data: items,
    columns,
    rowActions: canManage ? rowActions : undefined,
    getRowId: (row) => row.id,
    fillColumn: "address",
    enableSorting: false,
    enableSelection: false,
    enablePagination: false,
  });

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-form-section">
      <header className="flex flex-col gap-region sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-heading-sm">Ship-Tos</h2>
          <p className="text-body-sm text-fg-secondary mt-1">
            Delivery addresses for this customer. One default is required before
            shipping orders.
          </p>
        </div>
        {canManage ? (
          <Button type="button" variant="primary" onClick={() => setCreateOpen(true)}>
            <Plus className="size-icon-lg" aria-hidden />
            Add Ship-To
          </Button>
        ) : null}
      </header>

      <Table
        sticky
        table={table}
        emptyMessage={
          query.isLoading ? "Loading ship-tos…" : "No ship-to addresses yet."
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
            title="Add ship-to"
            schema={shipToSchema}
            defaultValues={{
              line1: "",
              line2: "",
              city: "",
              region: "",
              postal: "",
              country: "",
              isDefault: items.length === 0,
            }}
            mutate={(data) =>
              createShipTo({
                id: customerId,
                data: toShipToBody(data),
              })
            }
            successMessage="Ship-to added"
            invalidate={[getListInternalCustomerShipTosQueryKey(customerId)]}
            submitLabel="Add Ship-To"
            data-testid="customer-ship-to-create-dialog"
          >
            <ShipToFormFields showDefault />
          </FormDialog>

          {editing ? (
            <FormDialog
              open
              onOpenChange={(open) => {
                if (!open) {
                  setEditing(null);
                }
              }}
              title="Edit ship-to"
              schema={shipToSchema}
              defaultValues={{
                line1: editing.line1,
                line2: editing.line2 ?? "",
                city: editing.city,
                region: editing.region,
                postal: editing.postal,
                country: editing.country,
                isDefault: editing.isDefault,
              }}
              mutate={(data) =>
                updateShipTo({
                  id: customerId,
                  shipToId: editing.id,
                  data: toShipToBody(data),
                })
              }
              successMessage="Ship-to updated"
              invalidate={[getListInternalCustomerShipTosQueryKey(customerId)]}
              submitLabel="Save Changes"
              data-testid="customer-ship-to-edit-dialog"
            >
              <ShipToFormFields showDefault />
            </FormDialog>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
