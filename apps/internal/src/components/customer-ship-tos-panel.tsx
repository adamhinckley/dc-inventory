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
import { Pencil, Plus, Star } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { formatPostalAddressInline } from "../lib/postal-address-format";
import { mergeStableIds } from "../lib/stable-item-order";
import {
  SHIP_TOS_DESCRIPTION,
  SHIP_TOS_EMPTY_MESSAGE,
} from "../lib/customer-address-empty-copy";
import { orvalQueryFailed } from "../lib/orval-query-load";
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
  const query = useListInternalCustomerShipTos(customerId);
  const fetchedItems =
    query.data?.status === 200 ? query.data.data.items : ([] as CustomerShipToRow[]);
  const orderRef = useRef<{ customerId: string; ids: string[] }>({
    customerId,
    ids: [],
  });
  if (orderRef.current.customerId !== customerId) {
    orderRef.current = { customerId, ids: [] };
  }
  const items = useMemo(() => {
    const nextIds = mergeStableIds(
      orderRef.current.ids,
      fetchedItems.map((row) => row.id),
    );
    orderRef.current = { customerId, ids: nextIds };
    const byId = new Map(fetchedItems.map((row) => [row.id, row]));
    return nextIds.flatMap((id) => {
      const row = byId.get(id);
      return row === undefined ? [] : [row];
    });
  }, [customerId, fetchedItems]);
  const { mutateAsync: createShipTo } = useCreateInternalCustomerShipTo();
  const { mutateAsync: updateShipTo } = useUpdateInternalCustomerShipTo();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerShipToRow | null>(null);

  const rowActions = useCallback(
    (row: CustomerShipToRow) => (
      <div className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-tight">
        {row.isDefault ? (
          <span className="inline-flex items-center justify-end gap-icon text-button font-bold">
            <Star className="size-icon fill-warning text-warning" aria-hidden />
            Default
          </span>
        ) : (
          <span />
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setEditing(row)}
        >
          <Pencil className="size-icon" aria-hidden />
          Edit
        </Button>
      </div>
    ),
    [],
  );

  const columns = useMemo<TableColumnDef<CustomerShipToRow>[]>(
    () => [
      {
        id: "address",
        label: "Address",
        sort: false as const,
        render: ({ record }) => formatPostalAddressInline(record),
      },
    ],
    [],
  );

  const table = useTable({
    data: items,
    isError: orvalQueryFailed(query),
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
          <p className="text-body-sm text-fg-secondary mt-1">{SHIP_TOS_DESCRIPTION}</p>
        </div>
        {canManage ? (
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="size-icon" aria-hidden />
            Add Ship-To
          </Button>
        ) : null}
      </header>

      <Table
        sticky
        table={table}
        emptyMessage={
          query.isLoading ? "Loading ship-tos…" : SHIP_TOS_EMPTY_MESSAGE
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
