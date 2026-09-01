import {
  Money,
  type OrganizationId,
  ProductId,
  Sku,
  type StaffUserId,
} from "@dc-inventory/shared-kernel";
import { newUuid } from "../domain/ids.js";
import type { IProductRepository } from "../domain/ports/product-repository.js";
import type { Product } from "../domain/product.js";
import { hasQtyWriteFields } from "./write-guards.js";

export type CreateProductRequest = {
  organizationId: OrganizationId;
  staffUserId: StaffUserId;
  sku: string;
  name: string;
  uom: string;
  masterPackPrice: number;
  currency?: string;
  inactive?: boolean;
  discontinued?: boolean;
  webWholesale?: boolean;
  description?: string | null;
  taxCategoryCode?: string | null;
};

export type CreateProductResult =
  | { ok: true; product: Product }
  | { ok: false; reason: "invalid" | "duplicate_sku" | "qty_not_allowed" };

export class CreateProductUseCase {
  constructor(private readonly products: IProductRepository) {}

  async execute(input: CreateProductRequest): Promise<CreateProductResult> {
    void input.staffUserId;
    if (hasQtyWriteFields(input)) {
      return { ok: false, reason: "qty_not_allowed" };
    }
    const name = input.name.trim();
    const uom = input.uom.trim();
    const description =
      input.description === undefined || input.description === null
        ? null
        : input.description.trim() || null;
    const taxCategoryCode =
      input.taxCategoryCode === undefined || input.taxCategoryCode === null
        ? null
        : input.taxCategoryCode.trim() || null;
    if (name.length === 0 || uom.length === 0) {
      return { ok: false, reason: "invalid" };
    }
    try {
      const sku = Sku.parse(input.sku);
      const existing = await this.products.findBySku(input.organizationId, sku);
      if (existing !== null) {
        return { ok: false, reason: "duplicate_sku" };
      }
      const product: Product = {
        id: ProductId.parse(newUuid()),
        organizationId: input.organizationId,
        sku,
        name,
        description,
        uom,
        masterPackPrice: Money.fromMinorUnits(
          input.masterPackPrice,
          input.currency ?? "USD",
        ),
        inactive: input.inactive ?? false,
        discontinued: input.discontinued ?? false,
        webWholesale: input.webWholesale ?? false,
        taxCategoryCode,
      };
      await this.products.save(product);
      return { ok: true, product };
    } catch {
      return { ok: false, reason: "invalid" };
    }
  }
}
