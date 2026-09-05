"use client";

import {
  getGetInternalCustomerBillToQueryKey,
  useCopyInternalCustomerBillToFromDefaultShipTo,
  useCreateInternalCustomerBillTo,
  useGetInternalCustomerBillTo,
  useListInternalCustomerShipTos,
  useUpdateInternalCustomerBillTo,
} from "@dc-inventory/api-client-internal";
import { Button, Form, FormDialog } from "@dc-inventory/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Copy, Pencil, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { z } from "zod";
import { formatPostalAddress } from "../lib/postal-address-format";

const billToSchema = z.object({
  line1: z.string().min(1),
  line2: z.string().optional().nullable(),
  city: z.string().min(1),
  region: z.string().min(1),
  postal: z.string().min(1),
  country: z.string().min(1),
});

type BillToFormInput = z.infer<typeof billToSchema>;

function toBillToBody(data: BillToFormInput) {
  return {
    line1: data.line1.trim(),
    line2: data.line2?.trim() ? data.line2.trim() : null,
    city: data.city.trim(),
    region: data.region.trim(),
    postal: data.postal.trim(),
    country: data.country.trim(),
  };
}

function BillToFormFields() {
  return (
    <>
      <Form.Field name="line1" label="Line 1" required form={{ kind: "text" }} />
      <Form.Field name="line2" label="Line 2" form={{ kind: "text" }} />
      <Form.Field name="city" label="City" required form={{ kind: "text" }} />
      <Form.Field name="region" label="State / region" required form={{ kind: "text" }} />
      <Form.Field name="postal" label="Postal code" required form={{ kind: "text" }} />
      <Form.Field name="country" label="Country" required form={{ kind: "text" }} />
    </>
  );
}

export function CustomerBillToPanel({
  customerId,
  canManage,
}: {
  customerId: string;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const billToQuery = useGetInternalCustomerBillTo(customerId);
  const shipTosQuery = useListInternalCustomerShipTos(customerId);
  const billTo = billToQuery.data?.status === 200 ? billToQuery.data.data : null;
  const shipTos =
    shipTosQuery.data?.status === 200 ? shipTosQuery.data.data.items : [];
  const defaultShipTo = shipTos.find((shipTo) => shipTo.isDefault);

  const { mutateAsync: createBillTo } = useCreateInternalCustomerBillTo();
  const { mutateAsync: updateBillTo } = useUpdateInternalCustomerBillTo();
  const { mutateAsync: copyFromDefault } =
    useCopyInternalCustomerBillToFromDefaultShipTo();

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const invalidateKey = useMemo(
    () => getGetInternalCustomerBillToQueryKey(customerId),
    [customerId],
  );

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-form-section">
      <header className="flex flex-col gap-region sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-heading-sm">Bill-To</h2>
          <p className="text-body-sm text-fg-secondary mt-1">
            Invoice address for this customer.
          </p>
        </div>
        {canManage ? (
          <div className="flex flex-wrap items-center gap-action">
            {billTo ? (
              <Button type="button" variant="secondary" onClick={() => setEditOpen(true)}>
                <Pencil className="size-icon-lg" aria-hidden />
                Edit Bill-To
              </Button>
            ) : (
              <>
                <Button type="button" variant="primary" onClick={() => setCreateOpen(true)}>
                  <Plus className="size-icon-lg" aria-hidden />
                  Add Bill-To
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!defaultShipTo}
                  title={
                    defaultShipTo
                      ? undefined
                      : "Set a default ship-to before copying bill-to."
                  }
                  onClick={() =>
                    void copyFromDefault({ id: customerId }).then(async () => {
                      await queryClient.invalidateQueries({
                        queryKey: invalidateKey,
                      });
                    })
                  }
                >
                  <Copy className="size-icon-lg" aria-hidden />
                  Copy From Default Ship-To
                </Button>
              </>
            )}
          </div>
        ) : null}
      </header>

      {billToQuery.isLoading ? (
        <p className="text-body-sm text-fg-secondary">Loading bill-to…</p>
      ) : billTo ? (
        <div className="section-flat rounded-section p-card">
          <dl className="space-y-1">
            {formatPostalAddress(billTo).map((line) => (
              <dd key={line}>{line}</dd>
            ))}
          </dl>
        </div>
      ) : (
        <div className="section-flat rounded-section p-card">
          <p className="text-body-sm text-fg-secondary">
            No bill-to address yet.
            {defaultShipTo
              ? " Add one manually or copy from the default ship-to."
              : " Shipping will refuse until a default ship-to exists, then you can copy bill-to from it."}
          </p>
        </div>
      )}

      {canManage ? (
        <>
          <FormDialog
            open={createOpen}
            onOpenChange={setCreateOpen}
            title="Add bill-to"
            schema={billToSchema}
            defaultValues={{
              line1: "",
              line2: "",
              city: "",
              region: "",
              postal: "",
              country: "",
            }}
            mutate={(data) => createBillTo({ id: customerId, data: toBillToBody(data) })}
            successMessage="Bill-to added"
            invalidate={invalidateKey}
            submitLabel="Add Bill-To"
            data-testid="customer-bill-to-create-dialog"
          >
            <BillToFormFields />
          </FormDialog>

          {billTo ? (
            <FormDialog
              open={editOpen}
              onOpenChange={setEditOpen}
              title="Edit bill-to"
              schema={billToSchema}
              defaultValues={{
                line1: billTo.line1,
                line2: billTo.line2 ?? "",
                city: billTo.city,
                region: billTo.region,
                postal: billTo.postal,
                country: billTo.country,
              }}
              mutate={(data) =>
                updateBillTo({ id: customerId, data: toBillToBody(data) })
              }
              successMessage="Bill-to updated"
              invalidate={invalidateKey}
              submitLabel="Save Changes"
              data-testid="customer-bill-to-edit-dialog"
            >
              <BillToFormFields />
            </FormDialog>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
