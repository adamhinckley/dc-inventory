"use client";

import {
  getListInternalSuppliersQueryKey,
  useCreateInternalSupplier,
  type createInternalSupplier,
} from "@dc-inventory/api-client-internal";
import { Form, useExplorerView, useFormSubmit } from "@dc-inventory/ui";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  SUPPLIER_PO_PREFIX_HELPER,
  supplierPoPrefixFieldSchema,
} from "../lib/supplier-po-prefix";
import { z } from "zod";

const createSupplierSchema = z.object({
  name: z.string().min(1, "Name is required"),
  vendorNumber: z.string().min(1, "Vendor number is required"),
  poPrefix: supplierPoPrefixFieldSchema,
});

type CreateSupplierInput = z.infer<typeof createSupplierSchema>;

export function SupplierCreateForm() {
  const router = useRouter();
  const { setCreateOpen } = useExplorerView();
  const { mutateAsync } = useCreateInternalSupplier();

  const onSubmit = useFormSubmit<CreateSupplierInput, Awaited<ReturnType<typeof createInternalSupplier>>>({
    mutate: (data) =>
      mutateAsync({
        data: {
          name: data.name,
          vendorNumber: data.vendorNumber,
          poPrefix: data.poPrefix,
        },
      }),
    successMessage: "Supplier created",
    invalidate: getListInternalSuppliersQueryKey(),
    onSuccess: (result) => {
      setCreateOpen(false);
      if (result.status === 201) {
        router.push(`/purchasing/suppliers/${result.data.id}`);
      }
    },
  });

  return (
    <Form
      schema={createSupplierSchema}
      defaultValues={{ name: "", vendorNumber: "", poPrefix: "" }}
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
          <Plus className="size-icon-lg" aria-hidden />
          Create Supplier
        </Form.Submit>
      </Form.Actions>
    </Form>
  );
}
