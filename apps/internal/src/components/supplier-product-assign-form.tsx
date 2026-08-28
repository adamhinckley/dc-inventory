"use client";

import {
  getListInternalSupplierProductsQueryKey,
  useAssignInternalSupplierProduct,
} from "@dc-inventory/api-client-internal";
import { Form, useExplorerView, useFormSubmit } from "@dc-inventory/ui";
import { z } from "zod";

const assignProductSchema = z.object({
  sku: z.string().min(1, "SKU is required"),
  supplierSku: z.string().optional(),
  minOrderQty: z.coerce.number().int().min(0).optional().nullable(),
  minOrderAmountCents: z.coerce.number().int().min(0).optional().nullable(),
  lastPoCostCents: z.coerce.number().int().min(0).optional().nullable(),
  currency: z.string().length(3).optional(),
});

type AssignProductInput = z.infer<typeof assignProductSchema>;

export function SupplierProductAssignForm({ supplierId }: { supplierId: string }) {
  const { setCreateOpen } = useExplorerView();
  const { mutateAsync } = useAssignInternalSupplierProduct();

  const onSubmit = useFormSubmit<AssignProductInput>({
    mutate: (data) =>
      mutateAsync({
        id: supplierId,
        data: {
          sku: data.sku,
          supplierSku: data.supplierSku?.trim() ? data.supplierSku : null,
          minOrderQty: data.minOrderQty ?? null,
          minOrderAmountCents: data.minOrderAmountCents ?? null,
          lastPoCostCents: data.lastPoCostCents ?? null,
          currency: data.currency ?? "USD",
        },
      }),
    successMessage: "Vendor SKU assigned",
    invalidate: getListInternalSupplierProductsQueryKey(supplierId),
    onSuccess: () => setCreateOpen(false),
  });

  return (
    <Form
      schema={assignProductSchema}
      defaultValues={{
        sku: "",
        supplierSku: "",
        minOrderQty: null,
        minOrderAmountCents: null,
        lastPoCostCents: null,
        currency: "USD",
      }}
      onSubmit={onSubmit}
    >
      <Form.Field name="sku" label="Catalog SKU" required form={{ kind: "text" }} />
      <Form.Field
        name="supplierSku"
        label="Vendor item #"
        form={{ kind: "text" }}
      />
      <Form.Field
        name="minOrderQty"
        label="Min order qty"
        form={{ kind: "number" }}
      />
      <Form.Field
        name="minOrderAmountCents"
        label="Min order amount (¢)"
        form={{ kind: "number" }}
      />
      <Form.Field
        name="lastPoCostCents"
        label="Last PO cost (¢)"
        form={{ kind: "number" }}
      />
      <Form.Field name="currency" label="Currency" form={{ kind: "text" }} />
      <Form.RootError />
      <Form.Actions>
        <Form.Submit>Assign SKU</Form.Submit>
      </Form.Actions>
    </Form>
  );
}
