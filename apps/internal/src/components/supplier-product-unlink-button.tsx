"use client";

import {
  getListInternalSupplierProductsQueryKey,
  useUnlinkInternalSupplierProduct,
} from "@dc-inventory/api-client-internal";
import { Button, FormDialog } from "@dc-inventory/ui";
import { z } from "zod";
import type { SupplierProductRow } from "../lib/supplier-product-types";

const unlinkSchema = z.object({});

export function SupplierProductUnlinkButton({
  supplierId,
  product,
}: {
  supplierId: string;
  product: SupplierProductRow;
}) {
  const { mutateAsync } = useUnlinkInternalSupplierProduct();

  return (
    <FormDialog
      trigger={
        <Button type="button" variant="ghost" size="sm">
          Unlink
        </Button>
      }
      title={`Unlink ${product.sku}?`}
      description="This vendor will no longer sell this catalog SKU. Inventory quantities are unchanged."
      schema={unlinkSchema}
      defaultValues={{}}
      mutate={() => mutateAsync({ id: supplierId, productId: product.id })}
      successMessage="Vendor SKU unlinked"
      invalidate={getListInternalSupplierProductsQueryKey(supplierId)}
      submitLabel="Unlink"
      submitVariant="destructive"
      confirm={() => ({
        title: `Unlink ${product.sku}?`,
        description: "This removes the vendor SKU assignment only.",
        confirmLabel: "Unlink",
        cancelLabel: "Cancel",
      })}
    >
      <span className="sr-only">Confirm unlink</span>
    </FormDialog>
  );
}
