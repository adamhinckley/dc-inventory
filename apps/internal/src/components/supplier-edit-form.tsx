"use client";

import {
  getGetInternalSupplierQueryKey,
  getListInternalSuppliersQueryKey,
  useUpdateInternalSupplier,
} from "@dc-inventory/api-client-internal";
import { Form, useDetailView, useFormSubmit } from "@dc-inventory/ui";
import { Save } from "lucide-react";
import {
  SUPPLIER_PO_PREFIX_HELPER,
  supplierPoPrefixFieldSchema,
  supplierPoPrefixFormDefault,
} from "../lib/supplier-po-prefix";
import { z } from "zod";
import type { SupplierDetail } from "../lib/supplier-types";

const editSupplierSchema = z.object({
  name: z.string().min(1, "Name is required"),
  vendorNumber: z.string().min(1, "Vendor number is required"),
  poPrefix: supplierPoPrefixFieldSchema,
});

type EditSupplierInput = z.infer<typeof editSupplierSchema>;

export function SupplierEditForm({ supplier }: { supplier: SupplierDetail }) {
  const { setEditOpen } = useDetailView();
  const { mutateAsync } = useUpdateInternalSupplier();

  const onSubmit = useFormSubmit<EditSupplierInput>({
    mutate: (data) =>
      mutateAsync({
        id: supplier.id,
        data: {
          name: data.name,
          vendorNumber: data.vendorNumber,
          poPrefix: data.poPrefix,
        },
      }),
    successMessage: "Supplier updated",
    invalidate: [
      getListInternalSuppliersQueryKey(),
      getGetInternalSupplierQueryKey(supplier.id),
    ],
    onSuccess: () => setEditOpen(false),
  });

  return (
    <Form
      schema={editSupplierSchema}
      defaultValues={{
        name: supplier.name,
        vendorNumber: supplier.vendorNumber,
        poPrefix: supplierPoPrefixFormDefault(supplier.poPrefix),
      }}
      onSubmit={onSubmit}
    >
      <Form.Field
        name="vendorNumber"
        label="Vendor #"
        required
        form={{ kind: "text" }}
      />
      <Form.Field name="name" label="Name" required form={{ kind: "text" }} />
      <Form.Field
        name="poPrefix"
        label="PO prefix"
        description={SUPPLIER_PO_PREFIX_HELPER}
        form={{ kind: "text" }}
      />
      <Form.RootError />
      <Form.Actions>
        <Form.Submit>
          <Save className="size-icon-lg" aria-hidden />
          Save Changes
        </Form.Submit>
      </Form.Actions>
    </Form>
  );
}
