"use client";

import {
  getGetInternalProductQueryKey,
  getListInternalProductsQueryKey,
  useGetInternalProduct,
  useUpdateInternalProduct,
} from "@dc-inventory/api-client-internal";
import { Dialog, Form, FormDialog } from "@dc-inventory/ui";
import { Save } from "lucide-react";
import { z } from "zod";

const emptyToNull = (value: unknown) =>
  value === "" || value === undefined ? null : value;

const editProductSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  uom: z.string().min(1),
  memberPriceCents: z.coerce.number().int().min(0),
  listPriceCents: z.preprocess(
    emptyToNull,
    z.union([z.coerce.number().int().min(0), z.null()]),
  ),
  currency: z.string().length(3),
  taxCategoryCode: z.string().optional().nullable(),
  caseQty: z.preprocess(
    emptyToNull,
    z.union([z.coerce.number().int().positive(), z.null()]),
  ),
  inactive: z.boolean(),
  discontinued: z.boolean(),
  webWholesale: z.boolean(),
});

export function CatalogProductEditDialog({
  productId,
  open,
  onOpenChange,
}: {
  productId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const query = useGetInternalProduct(productId, {
    query: {
      enabled: open && productId.length > 0,
      queryKey: getGetInternalProductQueryKey(productId),
    },
  });
  const product = query.data?.status === 200 ? query.data.data : undefined;
  const { mutateAsync } = useUpdateInternalProduct();

  if (!open) {
    return null;
  }

  if (product === undefined) {
    return (
      <Dialog open onOpenChange={onOpenChange}>
        <Dialog.Content size="lg" data-testid="catalog-product-edit-dialog">
          <Dialog.Header>
            <Dialog.Title>Edit product</Dialog.Title>
            <Dialog.Close />
          </Dialog.Header>
          <Dialog.Body>
            <p className="text-body-sm text-fg-secondary">
              {query.isError ? "Could not load this product." : "Loading product…"}
            </p>
          </Dialog.Body>
        </Dialog.Content>
      </Dialog>
    );
  }

  return (
    <FormDialog
      key={product.id}
      open
      onOpenChange={onOpenChange}
      size="lg"
      title={`Edit ${product.sku}`}
      description="SKU cannot change. Quantities come from inventory and are not editable here."
      schema={editProductSchema}
      defaultValues={{
        name: product.name,
        description: product.description ?? "",
        uom: product.uom,
        memberPriceCents: product.memberPriceCents,
        listPriceCents: product.listPriceCents,
        currency: product.currency,
        taxCategoryCode: product.taxCategoryCode ?? "",
        caseQty: product.caseQty,
        inactive: product.inactive,
        discontinued: product.discontinued,
        webWholesale: product.webWholesale,
      }}
      mutate={(data) =>
        mutateAsync({
          id: product.id,
          data: {
            name: data.name.trim(),
            description: data.description?.trim() ? data.description.trim() : null,
            uom: data.uom.trim(),
            memberPriceCents: data.memberPriceCents,
            listPriceCents: data.listPriceCents,
            currency: data.currency,
            taxCategoryCode: data.taxCategoryCode?.trim()
              ? data.taxCategoryCode.trim()
              : null,
            caseQty: data.caseQty,
            inactive: data.inactive,
            discontinued: data.discontinued,
            webWholesale: data.webWholesale,
          },
        })
      }
      successMessage="Product saved"
      invalidate={[
        getListInternalProductsQueryKey(),
        getGetInternalProductQueryKey(product.id),
      ]}
      submitLabel={
        <>
          <Save className="size-icon-lg" aria-hidden />
          Save Changes
        </>
      }
      data-testid="catalog-product-edit-dialog"
    >
      <Form.Field name="name" label="Name" required form={{ kind: "text" }} />
      <Form.Field
        name="description"
        label="Description"
        form={{ kind: "textarea" }}
      />
      <Form.Field name="uom" label="UOM" required form={{ kind: "text" }} />
      <Form.Field
        name="listPriceCents"
        label="List price (¢)"
        form={{ kind: "number" }}
      />
      <Form.Field
        name="memberPriceCents"
        label="Master pack price (¢)"
        required
        form={{ kind: "number" }}
      />
      <Form.Field name="currency" label="Currency" required form={{ kind: "text" }} />
      <Form.Field
        name="taxCategoryCode"
        label="Tax category"
        form={{ kind: "text" }}
      />
      <Form.Field name="caseQty" label="Case quantity" form={{ kind: "number" }} />
      <Form.Field name="inactive" label="Inactive" form={{ kind: "boolean" }} />
      <Form.Field
        name="discontinued"
        label="Discontinued"
        form={{ kind: "boolean" }}
      />
      <Form.Field
        name="webWholesale"
        label="Web wholesale"
        form={{ kind: "boolean" }}
      />
      <p className="text-body-sm text-fg-secondary">
        On hand {product.onHand} · on order {product.onOrder} · allocated{" "}
        {product.allocated} · available {product.available}
      </p>
    </FormDialog>
  );
}
