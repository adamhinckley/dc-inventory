"use client";

import {
  getGetInternalProductQueryKey,
  getListInternalProductsQueryKey,
  useGetInternalProduct,
  useUpdateInternalProduct,
} from "@dc-inventory/api-client-internal";
import type { getInternalProductResponse200 } from "@dc-inventory/api-client-internal";
import { Dialog, Form, FormDialog } from "@dc-inventory/ui";
import { Save } from "lucide-react";
import type { ReactNode } from "react";
import { z } from "zod";

const emptyToNull = (value: unknown) =>
  value === "" || value === undefined ? null : value;

const optionalNullableString = z.preprocess(
  emptyToNull,
  z.union([z.string(), z.null()]),
);

const optionalNullablePositiveInt = z.preprocess(
  emptyToNull,
  z.union([z.coerce.number().int().positive(), z.null()]),
);

const optionalNullableCents = z.preprocess(
  emptyToNull,
  z.union([z.coerce.number().int().min(0), z.null()]),
);

const CATEGORY_FORM_FIELDS = [
  "category1",
  "category2",
  "category3",
  "category4",
  "category5",
  "category6",
  "category7",
  "category8",
  "category9",
  "category10",
] as const;

const editProductSchema = z.object({
  name: z.string().min(1),
  description: optionalNullableString,
  uom: z.string().min(1),
  memberPriceCents: z.coerce.number().int().min(0),
  listPriceCents: optionalNullableCents,
  originalWholesalePriceCents: optionalNullableCents,
  currency: z.string().length(3),
  countryOfOrigin: optionalNullableString,
  material: optionalNullableString,
  length: optionalNullableString,
  width: optionalNullableString,
  height: optionalNullableString,
  diameter: optionalNullableString,
  size: optionalNullableString,
  weight: optionalNullableString,
  weightUom: optionalNullableString,
  catalogPage: optionalNullableString,
  defaultOrderQty: optionalNullablePositiveInt,
  defaultWeight: optionalNullableString,
  defaultWeightUom: optionalNullableString,
  upc: optionalNullableString,
  mfgCode: optionalNullableString,
  altCode: optionalNullableString,
  alt2Code: optionalNullableString,
  alt3Code: optionalNullableString,
  category1: optionalNullableString,
  category2: optionalNullableString,
  category3: optionalNullableString,
  category4: optionalNullableString,
  category5: optionalNullableString,
  category6: optionalNullableString,
  category7: optionalNullableString,
  category8: optionalNullableString,
  category9: optionalNullableString,
  category10: optionalNullableString,
  packLength: optionalNullableString,
  packWidth: optionalNullableString,
  packHeight: optionalNullableString,
  packWeight: optionalNullableString,
  packWeightUom: optionalNullableString,
  innerPackQty: optionalNullablePositiveInt,
  innerPackLength: optionalNullableString,
  innerPackWidth: optionalNullableString,
  innerPackHeight: optionalNullableString,
  innerPackWeight: optionalNullableString,
  innerPackWeightUom: optionalNullableString,
  caseQty: optionalNullablePositiveInt,
  caseLength: optionalNullableString,
  caseWidth: optionalNullableString,
  caseHeight: optionalNullableString,
  caseWeight: optionalNullableString,
  caseWeightUom: optionalNullableString,
  inactive: z.boolean(),
  discontinued: z.boolean(),
  webWholesale: z.boolean(),
  nonStock: z.boolean(),
  noExport: z.boolean(),
  webRetail: z.boolean(),
});

type EditProductInput = z.infer<typeof editProductSchema>;

function trimOrNull(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-form-field">
      <p className="text-label font-semibold">{title}</p>
      {children}
    </div>
  );
}

function ReadOnlyRow({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  const display =
    value === null || value === undefined || value === "" ? "—" : String(value);
  return (
    <p className="text-body-sm">
      <span className="text-fg-secondary">{label}: </span>
      {display}
    </p>
  );
}

function categoryNamesFromForm(data: EditProductInput): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const field of CATEGORY_FORM_FIELDS) {
    const name = trimOrNull(data[field] ?? "");
    if (name === null || seen.has(name)) {
      continue;
    }
    seen.add(name);
    names.push(name);
  }
  return names;
}

function categoryFieldsFromNames(names: readonly string[]): Record<
  (typeof CATEGORY_FORM_FIELDS)[number],
  string
> {
  return Object.fromEntries(
    CATEGORY_FORM_FIELDS.map((field, index) => [field, names[index] ?? ""]),
  ) as Record<(typeof CATEGORY_FORM_FIELDS)[number], string>;
}

function productToFormValues(
  product: getInternalProductResponse200["data"],
): EditProductInput {
  const altCodes = product.altCodes;
  return {
    name: product.name,
    description: product.description ?? "",
    uom: product.uom,
    memberPriceCents: product.memberPriceCents,
    listPriceCents: product.listPriceCents,
    originalWholesalePriceCents: product.originalWholesalePriceCents,
    currency: product.currency,
    countryOfOrigin: product.countryOfOrigin ?? "",
    material: product.material ?? "",
    length: product.length ?? "",
    width: product.width ?? "",
    height: product.height ?? "",
    diameter: product.diameter ?? "",
    size: product.size ?? "",
    weight: product.weight ?? "",
    weightUom: product.weightUom ?? "",
    catalogPage: product.catalogPage ?? "",
    defaultOrderQty: product.defaultOrderQty,
    defaultWeight: product.defaultWeight ?? "",
    defaultWeightUom: product.defaultWeightUom ?? "",
    upc: product.upc ?? "",
    mfgCode: product.mfgCode ?? "",
    altCode: altCodes[0] ?? "",
    alt2Code: altCodes[1] ?? "",
    alt3Code: altCodes[2] ?? "",
    ...categoryFieldsFromNames(product.categoryNames),
    packLength: product.packLength ?? "",
    packWidth: product.packWidth ?? "",
    packHeight: product.packHeight ?? "",
    packWeight: product.packWeight ?? "",
    packWeightUom: product.packWeightUom ?? "",
    innerPackQty: product.innerPackQty,
    innerPackLength: product.innerPackLength ?? "",
    innerPackWidth: product.innerPackWidth ?? "",
    innerPackHeight: product.innerPackHeight ?? "",
    innerPackWeight: product.innerPackWeight ?? "",
    innerPackWeightUom: product.innerPackWeightUom ?? "",
    caseQty: product.caseQty,
    caseLength: product.caseLength ?? "",
    caseWidth: product.caseWidth ?? "",
    caseHeight: product.caseHeight ?? "",
    caseWeight: product.caseWeight ?? "",
    caseWeightUom: product.caseWeightUom ?? "",
    inactive: product.inactive,
    discontinued: product.discontinued,
    webWholesale: product.webWholesale,
    nonStock: product.nonStock,
    noExport: product.noExport,
    webRetail: product.webRetail,
  };
}

function formToPatch(data: EditProductInput) {
  return {
    name: data.name.trim(),
    description: trimOrNull(data.description ?? ""),
    uom: data.uom.trim(),
    memberPriceCents: data.memberPriceCents,
    listPriceCents: data.listPriceCents,
    originalWholesalePriceCents: data.originalWholesalePriceCents,
    currency: data.currency,
    countryOfOrigin: trimOrNull(data.countryOfOrigin ?? ""),
    material: trimOrNull(data.material ?? ""),
    length: trimOrNull(data.length ?? ""),
    width: trimOrNull(data.width ?? ""),
    height: trimOrNull(data.height ?? ""),
    diameter: trimOrNull(data.diameter ?? ""),
    size: trimOrNull(data.size ?? ""),
    weight: trimOrNull(data.weight ?? ""),
    weightUom: trimOrNull(data.weightUom ?? ""),
    catalogPage: trimOrNull(data.catalogPage ?? ""),
    defaultOrderQty: data.defaultOrderQty,
    defaultWeight: trimOrNull(data.defaultWeight ?? ""),
    defaultWeightUom: trimOrNull(data.defaultWeightUom ?? ""),
    upc: trimOrNull(data.upc ?? ""),
    mfgCode: trimOrNull(data.mfgCode ?? ""),
    altCodes: [data.altCode, data.alt2Code, data.alt3Code]
      .map((code) => trimOrNull(code ?? ""))
      .filter((code): code is string => code !== null),
    categoryNames: categoryNamesFromForm(data),
    packLength: trimOrNull(data.packLength ?? ""),
    packWidth: trimOrNull(data.packWidth ?? ""),
    packHeight: trimOrNull(data.packHeight ?? ""),
    packWeight: trimOrNull(data.packWeight ?? ""),
    packWeightUom: trimOrNull(data.packWeightUom ?? ""),
    innerPackQty: data.innerPackQty,
    innerPackLength: trimOrNull(data.innerPackLength ?? ""),
    innerPackWidth: trimOrNull(data.innerPackWidth ?? ""),
    innerPackHeight: trimOrNull(data.innerPackHeight ?? ""),
    innerPackWeight: trimOrNull(data.innerPackWeight ?? ""),
    innerPackWeightUom: trimOrNull(data.innerPackWeightUom ?? ""),
    caseQty: data.caseQty,
    caseLength: trimOrNull(data.caseLength ?? ""),
    caseWidth: trimOrNull(data.caseWidth ?? ""),
    caseHeight: trimOrNull(data.caseHeight ?? ""),
    caseWeight: trimOrNull(data.caseWeight ?? ""),
    caseWeightUom: trimOrNull(data.caseWeightUom ?? ""),
    inactive: data.inactive,
    discontinued: data.discontinued,
    webWholesale: data.webWholesale,
    nonStock: data.nonStock,
    noExport: data.noExport,
    webRetail: data.webRetail,
  };
}

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
      defaultValues={productToFormValues(product)}
      mutate={(data) =>
        mutateAsync({
          id: product.id,
          data: formToPatch(data),
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
      <FormSection title="Basics">
        <Form.Field name="name" label="Name" required form={{ kind: "text" }} />
        <Form.Field
          name="description"
          label="Description"
          form={{ kind: "textarea" }}
        />
        <Form.Field name="uom" label="UOM" required form={{ kind: "text" }} />
        <Form.Field
          name="catalogPage"
          label="Catalog page"
          form={{ kind: "text" }}
        />
        <Form.Field
          name="countryOfOrigin"
          label="Country of origin"
          form={{ kind: "text" }}
        />
        <Form.Field name="material" label="Material" form={{ kind: "text" }} />
        <Form.Field name="size" label="Size" form={{ kind: "text" }} />
      </FormSection>

      <FormSection title="Pricing">
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
        <Form.Field
          name="originalWholesalePriceCents"
          label="Original wholesale price (¢)"
          form={{ kind: "number" }}
        />
        <Form.Field name="currency" label="Currency" required form={{ kind: "text" }} />
        <Form.Field
          name="defaultOrderQty"
          label="Default order qty"
          form={{ kind: "number" }}
        />
      </FormSection>

      <FormSection title="Dimensions & weight">
        <Form.Field name="length" label="Length" form={{ kind: "text" }} />
        <Form.Field name="width" label="Width" form={{ kind: "text" }} />
        <Form.Field name="height" label="Height" form={{ kind: "text" }} />
        <Form.Field name="diameter" label="Diameter" form={{ kind: "text" }} />
        <Form.Field name="weight" label="Weight" form={{ kind: "text" }} />
        <Form.Field name="weightUom" label="Weight UOM" form={{ kind: "text" }} />
        <Form.Field
          name="defaultWeight"
          label="Default weight"
          form={{ kind: "text" }}
        />
        <Form.Field
          name="defaultWeightUom"
          label="Default weight UOM"
          form={{ kind: "text" }}
        />
      </FormSection>

      <FormSection title="Identifiers">
        <Form.Field name="upc" label="UPC (upcode)" form={{ kind: "text" }} />
        <Form.Field name="mfgCode" label="MFG code" form={{ kind: "text" }} />
        <Form.Field name="altCode" label="Alt code" form={{ kind: "text" }} />
        <Form.Field name="alt2Code" label="Alt code 2" form={{ kind: "text" }} />
        <Form.Field name="alt3Code" label="Alt code 3" form={{ kind: "text" }} />
      </FormSection>

      <FormSection title="Categories">
        <Form.Field name="category1" label="Category 1" form={{ kind: "text" }} />
        <Form.Field name="category2" label="Category 2" form={{ kind: "text" }} />
        <Form.Field name="category3" label="Category 3" form={{ kind: "text" }} />
        <Form.Field name="category4" label="Category 4" form={{ kind: "text" }} />
        <Form.Field name="category5" label="Category 5" form={{ kind: "text" }} />
        <Form.Field name="category6" label="Category 6" form={{ kind: "text" }} />
        <Form.Field name="category7" label="Category 7" form={{ kind: "text" }} />
        <Form.Field name="category8" label="Category 8" form={{ kind: "text" }} />
        <Form.Field name="category9" label="Category 9" form={{ kind: "text" }} />
        <Form.Field name="category10" label="Category 10" form={{ kind: "text" }} />
      </FormSection>

      <FormSection title="Primary vendor">
        <ReadOnlyRow label="Vendor #" value={product.vendorNumber} />
        <ReadOnlyRow label="Vendor" value={product.vendorName} />
        <ReadOnlyRow label="Min order qty" value={product.minOrderQty} />
        <ReadOnlyRow label="Min order amount (¢)" value={product.minOrderAmountCents} />
        <ReadOnlyRow label="Last PO cost (¢)" value={product.lastPoCostCents} />
        <p className="text-body-sm text-fg-secondary">
          Vendor terms are linked on import. Edit mins and costs on the supplier product screen.
        </p>
      </FormSection>

      <FormSection title="Reorder (read-only)">
        <ReadOnlyRow label="Reorder min" value={product.reorderMin} />
        <ReadOnlyRow label="Reorder max" value={product.reorderMax} />
      </FormSection>

      <FormSection title="Inner pack">
        <Form.Field
          name="innerPackQty"
          label="Inner pack qty"
          form={{ kind: "number" }}
        />
        <Form.Field
          name="innerPackLength"
          label="Inner pack length"
          form={{ kind: "text" }}
        />
        <Form.Field
          name="innerPackWidth"
          label="Inner pack width"
          form={{ kind: "text" }}
        />
        <Form.Field
          name="innerPackHeight"
          label="Inner pack height"
          form={{ kind: "text" }}
        />
        <Form.Field
          name="innerPackWeight"
          label="Inner pack weight"
          form={{ kind: "text" }}
        />
        <Form.Field
          name="innerPackWeightUom"
          label="Inner pack weight UOM"
          form={{ kind: "text" }}
        />
      </FormSection>

      <FormSection title="Case pack">
        <Form.Field name="caseQty" label="Case quantity" form={{ kind: "number" }} />
        <Form.Field name="caseLength" label="Case length" form={{ kind: "text" }} />
        <Form.Field name="caseWidth" label="Case width" form={{ kind: "text" }} />
        <Form.Field name="caseHeight" label="Case height" form={{ kind: "text" }} />
        <Form.Field name="caseWeight" label="Case weight" form={{ kind: "text" }} />
        <Form.Field
          name="caseWeightUom"
          label="Case weight UOM"
          form={{ kind: "text" }}
        />
      </FormSection>

      <FormSection title="Unit pack">
        <Form.Field name="packLength" label="Pack length" form={{ kind: "text" }} />
        <Form.Field name="packWidth" label="Pack width" form={{ kind: "text" }} />
        <Form.Field name="packHeight" label="Pack height" form={{ kind: "text" }} />
        <Form.Field name="packWeight" label="Pack weight" form={{ kind: "text" }} />
        <Form.Field
          name="packWeightUom"
          label="Pack weight UOM"
          form={{ kind: "text" }}
        />
      </FormSection>

      <FormSection title="Flags">
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
        <Form.Field name="webRetail" label="Web retail" form={{ kind: "boolean" }} />
        <Form.Field name="nonStock" label="Non stock" form={{ kind: "boolean" }} />
        <Form.Field name="noExport" label="No export" form={{ kind: "boolean" }} />
      </FormSection>

      <FormSection title="Inventory (read-only)">
        <ReadOnlyRow label="On hand" value={product.onHand} />
        <ReadOnlyRow label="On order (Qty on PO)" value={product.onOrder} />
        <ReadOnlyRow label="Allocated" value={product.allocated} />
        <ReadOnlyRow label="Available" value={product.available} />
        <ReadOnlyRow label="Committed (customer on order)" value={product.committed} />
        <ReadOnlyRow label="Available to sell" value={product.availableToSell} />
        <ReadOnlyRow label="Sell state" value={product.sellState} />
      </FormSection>
    </FormDialog>
  );
}
