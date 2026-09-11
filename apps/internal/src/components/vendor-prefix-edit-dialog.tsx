"use client";

import {
  getGetInternalSupplierQueryKey,
  getListInternalSuppliersQueryKey,
  getListInternalPreOrderFactoriesQueryKey,
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

const editVendorPrefixSchema = z.object({
  poPrefix: supplierPoPrefixFieldSchema,
});

type EditVendorPrefixInput = z.infer<typeof editVendorPrefixSchema>;

export function VendorPrefixEditDialog({
  supplierId,
  supplierName,
  poPrefix,
  open,
  onOpenChange,
}: {
  supplierId: string;
  supplierName: string;
  poPrefix: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { mutateAsync } = useUpdateInternalSupplier();

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Edit Vendor Prefix · ${supplierName}`}
      description="Short code on each PO number. Warehouse reads it off the box to tell which factory a shipment belongs to."
      schema={editVendorPrefixSchema}
      defaultValues={{
        poPrefix: supplierPoPrefixFormDefault(poPrefix),
      }}
      mutate={(data: EditVendorPrefixInput) =>
        mutateAsync({
          id: supplierId,
          data: { poPrefix: data.poPrefix },
        })
      }
      successMessage="Vendor prefix updated"
      invalidate={[
        getListInternalPreOrderFactoriesQueryKey(),
        getListInternalSuppliersQueryKey(),
        getGetInternalSupplierQueryKey(supplierId),
      ]}
      submitLabel={
        <>
          <Save className="size-icon-lg" aria-hidden />
          Save Prefix
        </>
      }
      data-testid="purchasing-2-uncovered-vendor-prefix-dialog"
    >
      <Form.Field
        name="poPrefix"
        label="Vendor prefix"
        description={SUPPLIER_PO_PREFIX_HELPER}
        form={{ kind: "text" }}
      />
    </FormDialog>
  );
}
