"use client";

import {
  getListInternalSupplierProductsQueryKey,
  useUpdateInternalSupplierProduct,
} from "@dc-inventory/api-client-internal";
import { Form, FormDialog } from "@dc-inventory/ui";
import { Save } from "lucide-react";
import { z } from "zod";
import type { SupplierProductRow } from "../lib/supplier-product-types";

const editProductSchema = z.object({
  supplierSku: z.string().optional(),
  minOrderQty: z.coerce.number().int().min(0).optional().nullable(),
  minOrderAmountCents: z.coerce.number().int().min(0).optional().nullable(),
  lastPoCostCents: z.coerce.number().int().min(0).optional().nullable(),
  currency: z.string().length(3).optional(),
});

type EditProductInput = z.infer<typeof editProductSchema>;

export function SupplierProductEditDialog({
  supplierId,
  product,
  open,
  onOpenChange,
}: {
  supplierId: string;
  product: SupplierProductRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { mutateAsync } = useUpdateInternalSupplierProduct();

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Edit ${product.sku}`}
      description="Update vendor terms for this catalog SKU."
      schema={editProductSchema}
      defaultValues={{
        supplierSku: product.supplierSku ?? "",
        minOrderQty: product.minOrderQty,
        minOrderAmountCents: product.minOrderAmountCents,
        lastPoCostCents: product.lastPoCostCents,
        currency: product.currency,
      }}
      mutate={(data) =>
        mutateAsync({
          id: supplierId,
          productId: product.id,
          data: {
            supplierSku: data.supplierSku?.trim() ? data.supplierSku : null,
            minOrderQty: data.minOrderQty ?? null,
            minOrderAmountCents: data.minOrderAmountCents ?? null,
            lastPoCostCents: data.lastPoCostCents ?? null,
            currency: data.currency,
          },
        })
      }
      successMessage="Vendor SKU updated"
      invalidate={getListInternalSupplierProductsQueryKey(supplierId)}
      submitLabel={
        <>
          <Save className="size-icon-lg" aria-hidden />
          Save Changes
        </>
      }
    >
      <Form.Field name="supplierSku" label="Vendor item #" form={{ kind: "text" }} />
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
    </FormDialog>
  );
}
