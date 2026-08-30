"use client";

import {
  getGetInternalPurchaseOrderFactorySendQueryKey,
  useUpdateInternalProductBySku,
} from "@dc-inventory/api-client-internal";
import { Form, FormDialog } from "@dc-inventory/ui";
import { z } from "zod";

const caseQtySchema = z.object({
  caseQty: z.coerce.number().int().positive(),
});

export function ProductCaseQtyDialog({
  sku,
  purchaseOrderId,
  open,
  onOpenChange,
}: {
  sku: string;
  purchaseOrderId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { mutateAsync } = useUpdateInternalProductBySku();

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Case quantity for ${sku}`}
      description="Case qty is stored on the product. tot_cartons uses it when the XLS downloads."
      schema={caseQtySchema}
      defaultValues={{ caseQty: undefined }}
      mutate={(data) =>
        mutateAsync({
          sku,
          data: { caseQty: data.caseQty },
        })
      }
      successMessage="Case quantity saved"
      invalidate={
        purchaseOrderId
          ? getGetInternalPurchaseOrderFactorySendQueryKey(purchaseOrderId)
          : undefined
      }
      submitLabel="Save"
    >
      <Form.Field
        name="caseQty"
        label="Case quantity"
        form={{ kind: "number" }}
      />
    </FormDialog>
  );
}
