"use client";

import {
  getGetInternalSupplierQueryKey,
  getListInternalSuppliersQueryKey,
  useUpdateInternalSupplier,
} from "@dc-inventory/api-client-internal";
import { Form, FormDialog } from "@dc-inventory/ui";
import { Save } from "lucide-react";
import { z } from "zod";
import {
  SUPPLIER_PO_PREFIX_HELPER,
  supplierPoPrefixFieldSchema,
  supplierPoPrefixFormDefault,
} from "../lib/supplier-po-prefix";
import type { SupplierRow } from "../lib/supplier-types";
import { throwIfSupplierWriteFailed } from "../lib/supplier-write-errors";

const editSupplierSchema = z.object({
  name: z.string().min(1, "Name is required"),
  vendorNumber: z.string().min(1, "Vendor number is required"),
  poPrefix: supplierPoPrefixFieldSchema,
});

export function SupplierEditDialog({
  supplier,
  open,
  onOpenChange,
}: {
  supplier: SupplierRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { mutateAsync } = useUpdateInternalSupplier();

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Edit ${supplier.name}`}
      description="Update the vendor number, name, and PO prefix."
      schema={editSupplierSchema}
      defaultValues={{
        name: supplier.name,
        vendorNumber: supplier.vendorNumber,
        poPrefix: supplierPoPrefixFormDefault(supplier.poPrefix),
      }}
      mutate={async (data) => {
        const result = await mutateAsync({
          id: supplier.id,
          data: {
            name: data.name,
            vendorNumber: data.vendorNumber,
            poPrefix: data.poPrefix,
          },
        });
        throwIfSupplierWriteFailed(result);
        return result;
      }}
      successMessage="Supplier updated"
      invalidate={[
        getListInternalSuppliersQueryKey(),
        getGetInternalSupplierQueryKey(supplier.id),
      ]}
      submitLabel={
        <>
          <Save className="size-icon-lg" aria-hidden />
          Save Changes
        </>
      }
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
    </FormDialog>
  );
}
