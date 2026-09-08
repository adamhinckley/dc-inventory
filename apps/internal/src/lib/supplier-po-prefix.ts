import { z } from "zod";

export const SUPPLIER_PO_PREFIX_HELPER =
  "2–4 uppercase letters or digits. Warehouse reads this off the box.";

export const supplierPoPrefixFieldSchema = z
  .string()
  .transform((value) => {
    const trimmed = value.trim().toUpperCase();
    return trimmed.length === 0 ? null : trimmed;
  })
  .pipe(
    z.union([
      z.null(),
      z
        .string()
        .regex(
          /^[A-Z0-9]{2,4}$/,
          "PO prefix must be 2–4 uppercase letters or digits",
        ),
    ]),
  );

export function supplierPoPrefixFormDefault(value: string | null | undefined): string {
  return value ?? "";
}
